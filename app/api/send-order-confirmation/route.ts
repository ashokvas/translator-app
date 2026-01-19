import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getEmailTemplate, type EmailKind } from '@/lib/email-templates';
import { sendEmail } from '@/lib/email';

const INTERNAL_BCC_RECIPIENTS = [
  'admin@translationaxis.com',
  'ashokvas@gmail.com',
  'vaswani.sun@gmail.com',
] as const;

const ALLOWED_KINDS = [
  'order_created',
  'payment_reminder',
  'final_notice',
  'payment_confirmed',
  'quote_ready',
] as const satisfies readonly EmailKind[];

function isEmailKind(value: unknown): value is EmailKind {
  return typeof value === 'string' && (ALLOWED_KINDS as readonly string[]).includes(value);
}

/**
 * Sends transactional emails (order created, reminders, payment confirmed, quote ready).
 *
 * Auth:
 * - Normal app calls require Clerk auth.
 * - Convex cron calls are allowed via `x-email-webhook-secret` matching `EMAIL_WEBHOOK_SECRET`.
 */
export async function POST(req: Request) {
  try {
    const secret = process.env.EMAIL_WEBHOOK_SECRET;
    const providedSecret = req.headers.get('x-email-webhook-secret');
    const isCronAuthorized = Boolean(secret && providedSecret && providedSecret === secret);

    const { userId } = await auth().catch(() => ({ userId: null as string | null }));
    if (!isCronAuthorized && !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const kind = body.kind;
    const email = body.email;
    const orderId = body.orderId;
    const orderNumber = body.orderNumber;
    const amount = body.amount;
    const totalPages = body.totalPages;
    const fileCount = body.fileCount;
    const sourceLanguage = body.sourceLanguage;
    const targetLanguage = body.targetLanguage;

    if (!isEmailKind(kind)) {
      return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });
    }
    if (typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }
    if (typeof orderId !== 'string' || orderId.length === 0) {
      return NextResponse.json({ error: 'Invalid orderId' }, { status: 400 });
    }
    if (typeof orderNumber !== 'string' || orderNumber.length === 0) {
      return NextResponse.json({ error: 'Invalid orderNumber' }, { status: 400 });
    }
    if (typeof amount !== 'number' || !Number.isFinite(amount)) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }
    if (typeof totalPages !== 'number' || !Number.isFinite(totalPages)) {
      return NextResponse.json({ error: 'Invalid totalPages' }, { status: 400 });
    }
    if (typeof fileCount !== 'number' || !Number.isFinite(fileCount)) {
      return NextResponse.json({ error: 'Invalid fileCount' }, { status: 400 });
    }
    if (typeof sourceLanguage !== 'string' || sourceLanguage.length === 0) {
      return NextResponse.json({ error: 'Invalid sourceLanguage' }, { status: 400 });
    }
    if (typeof targetLanguage !== 'string' || targetLanguage.length === 0) {
      return NextResponse.json({ error: 'Invalid targetLanguage' }, { status: 400 });
    }

    const { subject, html } = getEmailTemplate(kind, {
      orderId,
      orderNumber,
      amount,
      totalPages,
      fileCount,
      sourceLanguage,
      detectedSourceLanguage:
        typeof body.detectedSourceLanguage === 'string' || body.detectedSourceLanguage === null
          ? (body.detectedSourceLanguage as string | null)
          : undefined,
      targetLanguage,
      reminderNumber: typeof body.reminderNumber === 'number' ? body.reminderNumber : undefined,
      estimatedDeliveryDate:
        typeof body.estimatedDeliveryDate === 'number' ? body.estimatedDeliveryDate : undefined,
      customerName: typeof body.customerName === 'string' ? body.customerName : undefined,
    });

    const bcc = Array.from(
      new Set(
        INTERNAL_BCC_RECIPIENTS.filter((addr) => addr && addr.toLowerCase() !== email.toLowerCase())
      )
    );

    await sendEmail({
      to: email,
      bcc,
      subject,
      html,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('send-order-confirmation error:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}

