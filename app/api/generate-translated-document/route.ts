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
} from 'docx';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/generate-translated-document
 * Generates a Word document from translation segments
 * 
 * Body: {
 *   translationId: string,
 *   orderId: string,
 *   fileName: string
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
    const { translationId, orderId, fileName } = body;

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

    function pushMultilineText(text: string, opts?: { after?: number }) {
      const after = opts?.after ?? 0;
      const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
      if (lines.length === 0) {
        blocks.push(new Paragraph({ text: '', spacing: { after } }));
        return;
      }

      lines.forEach((rawLine, idx) => {
        const isLast = idx === lines.length - 1;
        const line = normalizeLineForDocx(rawLine);
        blocks.push(
          new Paragraph({
            children: [new TextRun({ text: line })],
            spacing: { after: isLast ? after : 0 },
          })
        );
      });
    }

    function paragraphsFromMultilineText(text: string): Paragraph[] {
      const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
      if (lines.length === 0) return [new Paragraph({ text: '' })];
      return lines.map((rawLine) => {
        const line = normalizeLineForDocx(rawLine);
        return new Paragraph({
          children: [new TextRun({ text: line })],
        });
      });
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

    const segmentsSorted = translation.segments.sort((a, b) => a.order - b.order);

    // Build bilingual table: Original (left) + Translation (right)
    const tableRows: TableRow[] = [];

    // Header row
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [new TextRun({ text: 'Original', bold: true })] })],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [new TextRun({ text: 'Translation', bold: true })] })],
          }),
        ],
      })
    );

    let lastPageNumber: number | undefined;
    for (const segment of segmentsSorted) {
      if (segment.pageNumber && segment.pageNumber !== lastPageNumber) {
        lastPageNumber = segment.pageNumber;
        // Page separator row (spans both columns)
        tableRows.push(
          new TableRow({
            children: [
              new TableCell({
                columnSpan: 2,
                children: [
                  new Paragraph({
                    text: `Page ${segment.pageNumber}`,
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 300, after: 150 },
                  }),
                ],
              }),
            ],
          })
        );
      }

      tableRows.push(
        new TableRow({
          children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              children: paragraphsFromMultilineText(segment.originalText || ''),
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              children: paragraphsFromMultilineText(segment.translatedText || ''),
            }),
          ],
        })
      );
    }

    blocks.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: tableRows,
      })
    );

    // Create document
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: blocks,
        },
      ],
    });

    // Generate buffer
    const buffer = await Packer.toBuffer(doc);

    // Upload to Convex storage
    const uploadUrl = await convexClient.mutation(api.files.generateUploadUrl);

    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
      // DOM lib types don't include Node.js Buffer in BodyInit, but Undici/Node fetch accepts Uint8Array.
      body: new Uint8Array(buffer),
    });

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload generated document to Convex');
    }

    const { storageId } = await uploadResponse.json();

    // Store file metadata
    const translatedFileName = fileName.replace(/\.[^.]+$/, '_translated.docx');
    const fileMetadata = await convexClient.mutation(api.files.storeFileMetadata, {
      storageId,
      fileName: translatedFileName,
      fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      fileSize: buffer.byteLength,
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
          fileSize: buffer.byteLength,
          fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          originalFileName: fileName,
        },
      ],
    });

    return NextResponse.json({
      success: true,
      fileName: translatedFileName,
      fileUrl: fileMetadata.fileUrl,
      message: 'Translated document generated successfully',
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

