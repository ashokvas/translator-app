import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { amount, orderId } = await request.json();

    // In production, use PayPal SDK to create order
    // For now, return a mock order ID
    const paypalOrderId = `PAYPAL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return NextResponse.json({ orderId: paypalOrderId });
  } catch (error) {
    console.error('PayPal create order error:', error);
    return NextResponse.json(
      { error: 'Failed to create PayPal order' },
      { status: 500 }
    );
  }
}

