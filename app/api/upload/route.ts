import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import { Buffer } from 'buffer';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

export const runtime = 'nodejs';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = new Set<string>([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
]);

async function countPdfPages(buffer: Buffer, fileName: string): Promise<number> {
  // Primary: pdf-parse v2+ API (PDFParse class). This is reliable for compressed PDFs.
  try {
    // pdf-parse@2.x exports a PDFParse class (ESM).
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const pdfParseMod: any = await import('pdf-parse');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const PDFParseCtor: any = pdfParseMod?.PDFParse;

    if (typeof PDFParseCtor === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const parser: any = new PDFParseCtor({ data: buffer });
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const info: any = await parser.getInfo();
      const n = Number(info?.total);
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        await parser.destroy();
      } catch {
        // ignore
      }
      if (Number.isFinite(n) && n > 0) {
        console.log(`[countPdfPages] ${fileName}: ${n} pages (PDFParse.getInfo)`);
        return n;
      }
    }
  } catch (err) {
    console.warn(`[countPdfPages] pdf-parse (PDFParse) failed for ${fileName}:`, err);
  }

  // Fallback 1: /Pages tree /Count (works for some uncompressed PDFs)
  try {
    const pdfString = buffer.toString('binary');
    const pagesCountMatches = [...pdfString.matchAll(/\/Type\s*\/Pages\b[\s\S]*?\/Count\s+(\d+)/g)];
    const counts = pagesCountMatches
      .map((m) => Number(m[1]))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (counts.length > 0) return Math.max(...counts);
  } catch {
    // ignore
  }

  // Fallback 2: count explicit /Type /Page objects (can under/overcount)
  try {
    const pdfString = buffer.toString('binary');
    const pageTypeMatches = pdfString.match(/\/Type\s*\/Page\b/g);
    if (pageTypeMatches && pageTypeMatches.length > 0) return pageTypeMatches.length;
  } catch {
    // ignore
  }

  // Fallback 3: size heuristic (least accurate)
  return Math.max(1, Math.ceil(buffer.byteLength / 150000));
}

async function convertToPdfWithLibreOffice(inputPath: string, outDir: string): Promise<string> {
  const libreOfficeBin = process.env.LIBREOFFICE_PATH || 'soffice';

  await fs.mkdir(outDir, { recursive: true });

  return await new Promise((resolve, reject) => {
    const args = [
      '--headless',
      '--nologo',
      '--nolockcheck',
      '--nodefault',
      '--nofirststartwizard',
      '--convert-to',
      'pdf',
      '--outdir',
      outDir,
      inputPath,
    ];

    const child = spawn(libreOfficeBin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    let stdout = '';

    child.stdout.on('data', (d) => (stdout += String(d)));
    child.stderr.on('data', (d) => (stderr += String(d)));

    child.on('error', (err) => {
      reject(
        new Error(
          `LibreOffice is required for DOCX/XLSX true page counts. Install LibreOffice and set LIBREOFFICE_PATH if needed. (${err.message})`
        )
      );
    });

    child.on('close', async (code) => {
      if (code !== 0) {
        reject(new Error(`LibreOffice conversion failed (code ${code}). ${stderr || stdout}`));
        return;
      }

      // LibreOffice outputs <base>.pdf in outDir
      const base = path.basename(inputPath).replace(/\.[^.]+$/, '');
      const pdfPath = path.join(outDir, `${base}.pdf`);
      try {
        await fs.access(pdfPath);
        resolve(pdfPath);
      } catch {
        reject(new Error(`LibreOffice reported success but PDF not found at ${pdfPath}`));
      }
    });
  });
}

async function checkLastPageIsBlank(pdfBuffer: Buffer): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const pdfParseMod: any = await import('pdf-parse');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const PDFParseCtor: any = pdfParseMod?.PDFParse;

    if (typeof PDFParseCtor === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const parser: any = new PDFParseCtor({ data: pdfBuffer });
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const info: any = await parser.getInfo();
        const totalPages = Number(info?.total);
        
        if (totalPages > 1 && Number.isFinite(totalPages)) {
          // Try to get text from the last page only
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          const textResult: any = await parser.getText({ partial: [totalPages] });
          const lastPageText = textResult?.text || '';
          const trimmedText = lastPageText.trim();
          
          // If last page has very little content (< 50 chars), consider it blank
          const isBlank = trimmedText.length < 50;
          
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          await parser.destroy();
          
          return isBlank;
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        await parser.destroy();
      } catch {
        try {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          await parser.destroy();
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // If we can't check, assume not blank (conservative)
  }
  return false;
}

async function countOfficePages(file: File, buffer: Buffer): Promise<number> {
  const tmpRoot = path.join(os.tmpdir(), 'translator-app');
  const runId = crypto.randomBytes(8).toString('hex');
  const runDir = path.join(tmpRoot, runId);
  const inPath = path.join(runDir, file.name);
  const outDir = path.join(runDir, 'out');

  await fs.mkdir(runDir, { recursive: true });
  await fs.writeFile(inPath, buffer);

  try {
    const pdfPath = await convertToPdfWithLibreOffice(inPath, outDir);
    const pdfBuf = await fs.readFile(pdfPath);
    let pageCount = await countPdfPages(pdfBuf, path.basename(pdfPath));
    
    // Check if LibreOffice added an extra blank page at the end
    // This is a common issue with DOCX conversion
    if (pageCount > 1) {
      const lastPageIsBlank = await checkLastPageIsBlank(pdfBuf);
      if (lastPageIsBlank) {
        console.log(`[countOfficePages] ${file.name}: Detected blank last page, adjusting count from ${pageCount} to ${pageCount - 1}`);
        pageCount = pageCount - 1;
      }
    }
    
    return pageCount;
  } finally {
    // best-effort cleanup
    try {
      await fs.rm(runDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get auth information
    const authResult = await auth();
    const userId = authResult?.userId;
    const getToken = authResult?.getToken;

    console.log('Auth result:', { hasUserId: !!userId, hasGetToken: !!getToken });

    if (!userId || !getToken) {
      console.error('Auth failed:', { userId, hasGetToken: !!getToken });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    // Get Convex URL from environment
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      return NextResponse.json(
        { error: 'Convex not configured' },
        { status: 500 }
      );
    }

    // Initialize Convex client for server-side mutations
    const convexClient = new ConvexHttpClient(convexUrl);
    // IMPORTANT:
    // Your Convex deployment currently has *no* auth providers configured (dashboard shows none),
    // so sending a Clerk token causes Convex to throw:
    // {"code":"NoAuthProvider","message":"No auth provider found matching the given token..."}
    //
    // These upload mutations do not require auth, so we intentionally do NOT set auth here.
    // const token = await getToken();
    // if (token) convexClient.setAuth(token);

    // Process and upload each file
    const uploadedFiles = await Promise.all(
      files.map(async (file) => {
        try {
          if (file.size > MAX_FILE_SIZE_BYTES) {
            throw new Error(`File "${file.name}" exceeds 10MB limit.`);
          }
          if (!ALLOWED_MIME_TYPES.has(file.type)) {
            throw new Error(`Unsupported file type for "${file.name}".`);
          }

          // 1. Get a signed upload URL from Convex
          const uploadUrl = await convexClient.mutation(api.files.generateUploadUrl);

          // 2. Upload the file directly to Convex storage using the signed URL
          const uploadResponse = await fetch(uploadUrl, {
            method: 'POST',
            headers: { 'Content-Type': file.type },
            body: file, // Send the file directly
          });

          if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            console.error('Direct Convex upload failed:', {
              status: uploadResponse.status,
              statusText: uploadResponse.statusText,
              error: errorText,
            });
            throw new Error(`Failed to upload file to Convex: ${errorText}`);
          }

          const { storageId } = await uploadResponse.json(); // Get storageId from Convex

          // 3. Process file (e.g., count pages for PDF)
          const arrayBuffer = await file.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          let pageCount = 1;

          if (file.type === 'application/pdf') {
            pageCount = await countPdfPages(buffer, file.name);
          } else if (file.type.startsWith('image/')) {
            pageCount = 1;
          } else {
            // DOCX/XLSX: true page count via LibreOffice render → PDF → page count
            pageCount = await countOfficePages(file, buffer);
          }

          // 4. Store file metadata in Convex via a mutation
          const fileMetadata = await convexClient.mutation(api.files.storeFileMetadata, {
            storageId,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            pageCount,
          });

          return fileMetadata;
        } catch (fileError) {
          console.error(`Error processing file ${file.name}:`, fileError);
          throw new Error(
            `Failed to process ${file.name}: ${fileError instanceof Error ? fileError.message : String(fileError)}`
          );
        }
      })
    );

    return NextResponse.json({ files: uploadedFiles });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      {
        error: 'Failed to upload files',
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

