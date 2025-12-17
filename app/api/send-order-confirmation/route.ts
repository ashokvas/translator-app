import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orderId, email, kind, orderNumber, amount } = await request.json();

    const emailKind: 'paid_confirmation' | 'payment_required' =
      kind === 'payment_required' ? 'payment_required' : 'paid_confirmation';

    const subject =
      emailKind === 'payment_required'
        ? 'Payment Required - Translation Order'
        : 'Translation Order Confirmation';

    const message =
      emailKind === 'payment_required'
        ? `Your translation order${orderNumber ? ` (${orderNumber})` : ''} has been created. Payment is required to begin processing.${
            typeof amount === 'number' ? ` Amount due: $${amount.toFixed(2)}.` : ''
          } Please sign in to your dashboard to complete payment.`
        : `Your order ${orderId} has been confirmed. Estimated delivery: 7 days.`;

    // In production, use an email service (SendGrid, Resend, etc.)
    // For now, log the email details
    console.log('Order confirmation email:', {
      to: email,
      orderId,
      orderNumber,
      amount,
      kind: emailKind,
      subject,
      message,
    });

    // TODO: Integrate with email service
    // Example with Resend:
    // await resend.emails.send({
    //   from: 'orders@yourdomain.com',
    //   to: email,
    //   subject: 'Translation Order Confirmation',
    //   html: `<h1>Order Confirmed</h1><p>Your order ${orderId}...</p>`,
    // });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Email send error:', error);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}

