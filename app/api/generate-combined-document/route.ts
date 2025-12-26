import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  PageBreak,
} from 'docx';
import FormData from 'form-data';
import { Readable } from 'stream';

export const runtime = 'nodejs';
export const maxDuration = 180; // 3 minutes for combining multiple documents

type ExportFormat = 'docx' | 'pdf';

/**
 * Convert DOCX buffer to PDF using LibreOffice service
 */
async function convertDocxToPdf(docxBuffer: Buffer, fileName: string): Promise<Buffer> {
  const libreofficeUrl = process.env.LIBREOFFICE_SERVICE_URL || 'http://localhost:3001';
  
  // Create form data with the DOCX file
  const formData = new FormData();
  formData.append('file', Readable.from(docxBuffer), {
    filename: fileName.replace(/\.[^.]+$/, '.docx'),
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

  const response = await fetch(`${libreofficeUrl}/convert-to-pdf`, {
    method: 'POST',
    body: formData as any,
    headers: formData.getHeaders() as any,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`LibreOffice conversion failed: ${response.status} ${errorText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Parse markdown table from text
 */
function parseMarkdownTable(lines: string[]): { headers: string[]; rows: string[][] } | null {
  if (lines.length < 2) return null;
  
  const headerLine = lines[0].trim();
  if (!headerLine.startsWith('|') || !headerLine.endsWith('|')) return null;
  
  // Using string-based validation to avoid Tailwind CSS parser confusion
  const separatorLine = lines[1].trim();
  if (!separatorLine.startsWith('|') || !separatorLine.endsWith('|')) return null;
  const separatorContent = separatorLine.slice(1, -1);
  if (!separatorContent) return null;
  for (let i = 0; i < separatorContent.length; i++) {
    const char = separatorContent[i];
    if (char !== '-' && char !== ':' && char !== ' ' && char !== '|') return null;
  }
  
  const headers = headerLine
    .split('|')
    .slice(1, -1)
    .map(h => h.trim());
  
  if (headers.length === 0) return null;
  
  const rows: string[][] = [];
  for (let i = 2; i < lines.length; i++) {
    const rowLine = lines[i].trim();
    if (!rowLine.startsWith('|')) break;
    
    const cells = rowLine
      .split('|')
      .slice(1, -1)
      .map(c => c.trim());
    
    while (cells.length < headers.length) {
      cells.push('');
    }
    
    rows.push(cells.slice(0, headers.length));
  }
  
  return { headers, rows };
}

/**
 * Create a Word table with borders
 */
function createWordTable(tableData: { headers: string[]; rows: string[][] }): Table {
  const borderStyle = {
    style: BorderStyle.SINGLE,
    size: 1,
    color: '000000',
  };
  
  const cellBorders = {
    top: borderStyle,
    bottom: borderStyle,
    left: borderStyle,
    right: borderStyle,
  };
  
  const tableRows: TableRow[] = [];
  
  // Header row
  tableRows.push(
    new TableRow({
      children: tableData.headers.map(header => 
        new TableCell({
          borders: cellBorders,
          children: [
            new Paragraph({
              children: [new TextRun({ text: header, bold: true })],
              alignment: AlignmentType.CENTER,
            }),
          ],
        })
      ),
    })
  );
  
  // Data rows
  for (const row of tableData.rows) {
    tableRows.push(
      new TableRow({
        children: row.map(cell => 
          new TableCell({
            borders: cellBorders,
            children: [
              new Paragraph({
                children: [new TextRun({ text: cell })],
              }),
            ],
          })
        ),
      })
    );
  }
  
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: tableRows,
  });
}

/**
 * Process translated text and convert markdown tables to Word tables
 */
function processTranslatedText(
  text: string,
  blocks: Array<Paragraph | Table>,
  normalizeLineForDocx: (line: string) => string
) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i];
    
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const tableLines: string[] = [];
      let j = i;
      while (j < lines.length && lines[j].trim().startsWith('|')) {
        tableLines.push(lines[j]);
        j++;
      }
      
      const tableData = parseMarkdownTable(tableLines);
      if (tableData && tableData.rows.length > 0) {
        blocks.push(createWordTable(tableData));
        blocks.push(new Paragraph({ text: '', spacing: { after: 200 } }));
        i = j;
        continue;
      }
    }
    
    const normalizedLine = normalizeLineForDocx(line);
    blocks.push(
      new Paragraph({
        children: [new TextRun({ text: normalizedLine })],
        spacing: { after: line.trim() === '' ? 200 : 0 },
      })
    );
    i++;
  }
}

/**
 * POST /api/generate-combined-document
 * Generates a combined Word or PDF document from multiple approved translations
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate admin
    const authResult = await auth();
    const userId = authResult?.userId;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin role via Convex
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      return NextResponse.json({ error: 'Convex not configured' }, { status: 500 });
    }

    const convexClient = new ConvexHttpClient(convexUrl);
    const userRole = await convexClient.query(api.users.getCurrentUserRole, {
      clerkId: userId,
    });

    if (userRole?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { orderId, fileNames, format: requestedFormat } = body;
    const format: ExportFormat = requestedFormat === 'pdf' ? 'pdf' : 'docx';

    if (!orderId || !fileNames || !Array.isArray(fileNames) || fileNames.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: orderId and fileNames array required' },
        { status: 400 }
      );
    }

    // Get order details
    const order = await convexClient.query(api.orders.getOrderWithFiles, {
      orderId: orderId as any,
      clerkId: userId,
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Get all translations for this order
    const allTranslations = await convexClient.query(api.translations.getTranslationsByOrder, {
      orderId: orderId as any,
      clerkId: userId,
    });

    if (!allTranslations || allTranslations.length === 0) {
      return NextResponse.json({ error: 'No translations found' }, { status: 404 });
    }

    // Filter to only the requested approved translations
    const selectedTranslations = allTranslations.filter(
      (t) => fileNames.includes(t.fileName) && t.status === 'approved'
    );

    if (selectedTranslations.length === 0) {
      return NextResponse.json(
        { error: 'No approved translations found for the specified files' },
        { status: 404 }
      );
    }

    // Sort translations by file name order as provided
    selectedTranslations.sort((a, b) => {
      return fileNames.indexOf(a.fileName) - fileNames.indexOf(b.fileName);
    });

    // Helper function
    function normalizeLineForDocx(line: string) {
      const leadingSpacesMatch = line.match(/^ +/);
      if (!leadingSpacesMatch) return line;
      const leadingSpaces = leadingSpacesMatch[0].length;
      return `${'\u00A0'.repeat(leadingSpaces)}${line.slice(leadingSpaces)}`;
    }

    // Build combined document
    const blocks: Array<Paragraph | Table> = [];

    // Document title
    blocks.push(
      new Paragraph({
        text: `Combined Translation Document`,
        heading: HeadingLevel.TITLE,
        spacing: { after: 200 },
      })
    );

    // Order info
    blocks.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Order: ${order.orderNumber}`,
            bold: true,
          }),
        ],
        spacing: { after: 100 },
      })
    );

    blocks.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Documents: ${selectedTranslations.length}`,
            italics: true,
          }),
        ],
        spacing: { after: 100 },
      })
    );

    blocks.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Generated: ${new Date().toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}`,
            italics: true,
          }),
        ],
        spacing: { after: 400 },
      })
    );

    // Table of contents
    blocks.push(
      new Paragraph({
        text: 'Contents:',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 },
      })
    );

    selectedTranslations.forEach((t, idx) => {
      blocks.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${idx + 1}. ${t.fileName}`,
            }),
          ],
          spacing: { after: 50 },
        })
      );
    });

    // Separator
    blocks.push(
      new Paragraph({
        text: '─'.repeat(60),
        spacing: { before: 400, after: 400 },
      })
    );

    // Add each translation with page breaks between them
    selectedTranslations.forEach((translation, docIndex) => {
      // Page break before each document (except first)
      if (docIndex > 0) {
        blocks.push(
          new Paragraph({
            children: [new PageBreak()],
          })
        );
      }

      // Document header
      blocks.push(
        new Paragraph({
          text: `Document ${docIndex + 1}: ${translation.fileName}`,
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 200 },
        })
      );

      blocks.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${translation.sourceLanguage} → ${translation.targetLanguage}`,
              italics: true,
            }),
          ],
          spacing: { after: 300 },
        })
      );

      // Sort segments by order
      const segmentsSorted = [...translation.segments].sort((a, b) => a.order - b.order);

      // Process each segment
      let lastPageNumber: number | undefined;
      for (const segment of segmentsSorted) {
        if (segment.pageNumber && segment.pageNumber !== lastPageNumber) {
          lastPageNumber = segment.pageNumber;
          blocks.push(
            new Paragraph({
              text: `Page ${segment.pageNumber}`,
              heading: HeadingLevel.HEADING_3,
              spacing: { before: 200, after: 100 },
            })
          );
        }

        // Process translated text - converts markdown tables to Word tables
        processTranslatedText(segment.translatedText || '', blocks, normalizeLineForDocx);
      }

      // Document separator
      if (docIndex < selectedTranslations.length - 1) {
        blocks.push(
          new Paragraph({
            text: '',
            spacing: { after: 400 },
          })
        );
      }
    });

    // Create document
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: blocks,
        },
      ],
    });

    // Generate DOCX buffer
    const docxBuffer = await Packer.toBuffer(doc);

    // Convert to PDF if requested
    let finalBuffer: Buffer;
    let fileExtension: string;
    let mimeType: string;

    if (format === 'pdf') {
      try {
        finalBuffer = await convertDocxToPdf(Buffer.from(docxBuffer), 'combined_translation');
        fileExtension = 'pdf';
        mimeType = 'application/pdf';
      } catch (pdfError) {
        console.error('PDF conversion failed, falling back to DOCX:', pdfError);
        // Fallback to DOCX if PDF conversion fails
        finalBuffer = Buffer.from(docxBuffer);
        fileExtension = 'docx';
        mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      }
    } else {
      finalBuffer = Buffer.from(docxBuffer);
      fileExtension = 'docx';
      mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }

    // Upload to Convex storage
    const uploadUrl = await convexClient.mutation(api.files.generateUploadUrl);

    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': mimeType },
      body: new Uint8Array(finalBuffer),
    });

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload generated document to Convex');
    }

    const { storageId } = await uploadResponse.json();

    // Generate combined file name
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const combinedFileName = `combined_translation_${order.orderNumber}_${timestamp}.${fileExtension}`;

    const fileMetadata = await convexClient.mutation(api.files.storeFileMetadata, {
      storageId,
      fileName: combinedFileName,
      fileType: mimeType,
      fileSize: finalBuffer.byteLength,
      pageCount: selectedTranslations.reduce((sum, t) => sum + t.segments.length, 0),
    });

    // Add to order's translatedFiles
    await convexClient.mutation(api.orders.uploadTranslatedFiles, {
      orderId: orderId as any,
      clerkId: userId,
      translatedFiles: [
        {
          fileName: combinedFileName,
          fileUrl: fileMetadata.fileUrl,
          storageId: storageId as any,
          fileSize: finalBuffer.byteLength,
          fileType: mimeType,
          originalFileName: `Combined: ${fileNames.join(', ')}`,
        },
      ],
    });

    return NextResponse.json({
      success: true,
      fileName: combinedFileName,
      fileUrl: fileMetadata.fileUrl,
      format: fileExtension,
      documentsIncluded: selectedTranslations.length,
      message: `Combined document generated successfully as ${fileExtension.toUpperCase()}`,
    });
  } catch (error) {
    console.error('Combined document generation error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate combined document',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
