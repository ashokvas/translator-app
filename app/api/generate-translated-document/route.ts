import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';

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
    const paragraphs: Paragraph[] = [];

    // Add title
    paragraphs.push(
      new Paragraph({
        text: `Translation: ${fileName}`,
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 400 },
      })
    );

    // Add metadata
    paragraphs.push(
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

    paragraphs.push(
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
    paragraphs.push(
      new Paragraph({
        text: '─'.repeat(50),
        spacing: { after: 400 },
      })
    );

    // Add each translated segment
    translation.segments
      .sort((a, b) => a.order - b.order)
      .forEach((segment, index) => {
        // Page header (if page number exists)
        if (segment.pageNumber) {
          paragraphs.push(
            new Paragraph({
              text: `Page ${segment.pageNumber}`,
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 400, after: 200 },
            })
          );
        }

        // Translated text
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: segment.translatedText,
              }),
            ],
            spacing: { after: 300 },
          })
        );

        // Add spacing between segments
        if (index < translation.segments.length - 1) {
          paragraphs.push(
            new Paragraph({
              text: '',
              spacing: { after: 200 },
            })
          );
        }
      });

    // Create document
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: paragraphs,
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
      body: buffer,
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

