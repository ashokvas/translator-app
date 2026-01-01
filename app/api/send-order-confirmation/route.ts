import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
import { getEmailTemplate, type EmailKind } from '@/lib/email-templates';

export async function POST(request: NextRequest) {
  try {
    // Check authentication (allow internal cron calls without auth)
    const { userId } = await auth();
    const isCronCall = request.headers.get('x-cron-call') === 'true';

    if (!userId && !isCronCall) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      kind,
      email,
      orderId,
      orderNumber,
      amount,
      totalPages,
      fileCount,
      sourceLanguage,
      targetLanguage,
      estimatedDeliveryDate,
      reminderNumber,
      customerName,
    } = body;

    // Validate required fields
    if (!kind || !email || !orderId || !orderNumber) {
      return NextResponse.json(
        { error: 'Missing required fields: kind, email, orderId, orderNumber' },
        { status: 400 }
      );
    }

    // Validate email kind
    const validKinds: EmailKind[] = ['order_created', 'payment_reminder', 'final_notice', 'payment_confirmed'];
    if (!validKinds.includes(kind as EmailKind)) {
      return NextResponse.json(
        { error: `Invalid email kind. Must be one of: ${validKinds.join(', ')}` },
        { status: 400 }
      );
    }

    // Get email template
    const { subject, html } = getEmailTemplate(kind as EmailKind, {
      orderNumber,
      amount: amount || 0,
      totalPages: totalPages || 0,
      fileCount: fileCount || 0,
      sourceLanguage: sourceLanguage || 'en',
      targetLanguage: targetLanguage || 'es',
      estimatedDeliveryDate,
      reminderNumber,
      customerName,
      orderId,
    });

    // Send email
    await sendEmail({
      to: email,
      subject,
      html,
    });

    console.log(`Email sent successfully: ${kind} for order ${orderNumber} to ${email}`);

    return NextResponse.json({ 
      success: true,
      message: `${kind} email sent successfully`,
    });
  } catch (error) {
    console.error('Email send error:', error);
    
    // Return more detailed error for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { 
        error: 'Failed to send email',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

