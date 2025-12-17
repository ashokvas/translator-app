import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orderID, orderId } = await request.json();

    // In production, use PayPal SDK to capture payment
    // For now, return success
    return NextResponse.json({
      success: true,
      status: 'COMPLETED',
      orderID,
      orderId,
    });
  } catch (error) {
    console.error('PayPal capture error:', error);
    return NextResponse.json(
      { error: 'Failed to capture payment' },
      { status: 500 }
    );
  }
}

