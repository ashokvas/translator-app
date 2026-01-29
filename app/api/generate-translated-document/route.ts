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
export const maxDuration = 120; // Increased for PDF conversion

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
 * Returns null if not a valid markdown table
 */
function parseMarkdownTable(lines: string[]): { headers: string[]; rows: string[][] } | null {
  if (lines.length < 2) return null;
  
  // Check if first line looks like a table header (starts and ends with |)
  const headerLine = lines[0].trim();
  if (!headerLine.startsWith('|') || !headerLine.endsWith('|')) return null;
  
  // Check if second line is separator (markdown table separator line)
  // Using string-based validation to avoid Tailwind CSS parser confusion
  const separatorLine = lines[1].trim();
  if (!separatorLine.startsWith('|') || !separatorLine.endsWith('|')) return null;
  const separatorContent = separatorLine.slice(1, -1);
  if (!separatorContent) return null;
  for (let i = 0; i < separatorContent.length; i++) {
    const char = separatorContent[i];
    if (char !== '-' && char !== ':' && char !== ' ' && char !== '|') return null;
  }
  
  // Parse header
  const headers = headerLine
    .split('|')
    .slice(1, -1) // Remove empty strings from start/end
    .map(h => h.trim());
  
  if (headers.length === 0) return null;
  
  // Parse data rows
  const rows: string[][] = [];
  for (let i = 2; i < lines.length; i++) {
    const rowLine = lines[i].trim();
    if (!rowLine.startsWith('|')) break; // End of table
    
    const cells = rowLine
      .split('|')
      .slice(1, -1)
      .map(c => c.trim());
    
    // Ensure row has same number of columns as header
    while (cells.length < headers.length) {
      cells.push('');
    }
    
    rows.push(cells.slice(0, headers.length));
  }
  
  return { headers, rows };
}

/**
 * Create a Word table with borders from parsed markdown table
 */
type ParsedTable = { headers: string[]; rows: string[][] };

function createWordTable(tableData: ParsedTable): Table {
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
  
  // Header row (bold)
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

function getTableChunkSize(totalColumns: number, maxColumns: number) {
  if (totalColumns > 5 && totalColumns % 5 === 0) return 5;
  if (totalColumns > 4 && totalColumns % 4 === 0) return 4;
  if (totalColumns > 3 && totalColumns % 3 === 0) return 3;
  return Math.min(maxColumns, totalColumns);
}

function splitWideTable(tableData: ParsedTable, maxColumns = 9): ParsedTable[] {
  const totalColumns = tableData.headers.length;
  if (totalColumns <= maxColumns) return [tableData];

  const chunkSize = getTableChunkSize(totalColumns, maxColumns);
  const chunks: ParsedTable[] = [];
  for (let start = 0; start < totalColumns; start += chunkSize) {
    const end = Math.min(start + chunkSize, totalColumns);
    chunks.push({
      headers: tableData.headers.slice(start, end),
      rows: tableData.rows.map((row) => row.slice(start, end)),
    });
  }

  return chunks;
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
    
    // Check if this is the start of a markdown table
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      // Collect all consecutive table lines
      const tableLines: string[] = [];
      let j = i;
      while (j < lines.length && lines[j].trim().startsWith('|')) {
        tableLines.push(lines[j]);
        j++;
      }
      
      // Try to parse as markdown table
      const tableData = parseMarkdownTable(tableLines);
      if (tableData && tableData.rows.length > 0) {
        // Split ultra-wide tables into page-sized chunks.
        const tableParts = splitWideTable(tableData);
        tableParts.forEach((part, index) => {
          blocks.push(createWordTable(part));
          blocks.push(new Paragraph({ text: '', spacing: { after: 200 } }));
          if (index < tableParts.length - 1) {
            blocks.push(new Paragraph({ children: [new PageBreak()] }));
          }
        });
        i = j; // Skip past table lines
        continue;
      }
    }
    
    // Regular text line
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
 * POST /api/generate-translated-document
 * Generates a Word or PDF document from translation segments
 * 
 * Body: {
 *   translationId: string,
 *   orderId: string,
 *   fileName: string,
 *   format?: 'docx' | 'pdf'  // default: 'docx'
 * }
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
    const { translationId, orderId, fileName, format: requestedFormat } = body;
    const format: ExportFormat = requestedFormat === 'pdf' ? 'pdf' : 'docx';

    if (!translationId || !orderId || !fileName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get translation data from Convex
    const translation = await convexClient.query(api.translations.getTranslationByFile, {
      orderId: orderId as any,
      fileName,
      clerkId: userId,
    });

    if (!translation || !translation.segments || translation.segments.length === 0) {
      return NextResponse.json(
        { error: 'Translation not found or empty' },
        { status: 404 }
      );
    }

    // Get order details for metadata
    const order = await convexClient.query(api.orders.getOrderWithFiles, {
      orderId: orderId as any,
      clerkId: userId,
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Create Word document
    const blocks: Array<Paragraph | Table> = [];

    function normalizeLineForDocx(line: string) {
      // Word can collapse leading spaces; preserve them using non‑breaking spaces.
      const leadingSpacesMatch = line.match(/^ +/);
      if (!leadingSpacesMatch) return line;
      const leadingSpaces = leadingSpacesMatch[0].length;
      return `${'\u00A0'.repeat(leadingSpaces)}${line.slice(leadingSpaces)}`;
    }

    // Add title
    blocks.push(
      new Paragraph({
        text: `Translation: ${fileName}`,
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 400 },
      })
    );

    // Add metadata
    blocks.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Order: ${order.orderNumber}`,
            bold: true,
          }),
        ],
        spacing: { after: 200 },
      })
    );

    blocks.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Source Language: ${translation.sourceLanguage} → Target Language: ${translation.targetLanguage}`,
            italics: true,
          }),
        ],
        spacing: { after: 400 },
      })
    );

    // Add horizontal line
    blocks.push(
      new Paragraph({
        text: '─'.repeat(50),
        spacing: { after: 400 },
      })
    );

    const segmentsSorted = translation.segments.sort((a: any, b: any) => a.order - b.order);

    // Process each segment
    let lastPageNumber: number | undefined;
    for (const segment of segmentsSorted) {
      if (segment.pageNumber && segment.pageNumber !== lastPageNumber) {
        lastPageNumber = segment.pageNumber;
        // Page separator
        blocks.push(
          new Paragraph({
            text: `Page ${segment.pageNumber}`,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 150 },
          })
        );
      }

      // Process translated text - converts markdown tables to Word tables
      processTranslatedText(segment.translatedText || '', blocks, normalizeLineForDocx);
    }

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
        finalBuffer = await convertDocxToPdf(Buffer.from(docxBuffer), fileName);
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
      // DOM lib types don't include Node.js Buffer in BodyInit, but Undici/Node fetch accepts Uint8Array.
      body: new Uint8Array(finalBuffer),
    });

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload generated document to Convex');
    }

    const { storageId } = await uploadResponse.json();

    // Store file metadata
    const translatedFileName = fileName.replace(/\.[^.]+$/, `_translated.${fileExtension}`);
    const fileMetadata = await convexClient.mutation(api.files.storeFileMetadata, {
      storageId,
      fileName: translatedFileName,
      fileType: mimeType,
      fileSize: finalBuffer.byteLength,
      pageCount: translation.segments.length,
    });

    // Add to order's translatedFiles
    await convexClient.mutation(api.orders.uploadTranslatedFiles, {
      orderId: orderId as any,
      clerkId: userId,
      translatedFiles: [
        {
          fileName: translatedFileName,
          fileUrl: fileMetadata.fileUrl,
          storageId: storageId as any,
          fileSize: finalBuffer.byteLength,
          fileType: mimeType,
          originalFileName: fileName,
        },
      ],
    });

    return NextResponse.json({
      success: true,
      fileName: translatedFileName,
      fileUrl: fileMetadata.fileUrl,
      format: fileExtension,
      message: `Translated document generated successfully as ${fileExtension.toUpperCase()}`,
    });
  } catch (error) {
    console.error('Document generation error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate document',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
