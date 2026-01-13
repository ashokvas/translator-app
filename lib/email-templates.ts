/**
 * Email Templates for Order Management
 * 
 * NOTE: Translation direction (source → target language) has been removed from all user-facing emails
 * as per requirements. Translation information is still stored in the database and visible to admins
 * in the admin dashboard, but is not shown to customers in emails or user-facing pages.
 */

export type EmailKind = 'order_created' | 'payment_reminder' | 'final_notice' | 'payment_confirmed' | 'quote_ready';

interface OrderEmailData {
  orderNumber: string;
  amount: number;
  totalPages: number;
  fileCount: number;
  sourceLanguage: string;
  detectedSourceLanguage?: string | null; // Actual detected language when sourceLanguage is 'auto'
  targetLanguage: string;
  estimatedDeliveryDate?: number;
  reminderNumber?: number; // 1, 2, or 3
  customerName?: string;
  orderId: string;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://translatoraxis.com';

// Simple HTML template for order created, reminders, and final notice
function getSimpleTemplate(
  title: string,
  heading: string,
  message: string,
  ctaText: string,
  ctaUrl: string,
  urgencyLevel: 'normal' | 'medium' | 'high' = 'normal'
): string {
  const urgencyColors = {
    normal: '#3b82f6', // blue
    medium: '#f59e0b', // amber
    high: '#ef4444', // red
  };

  const color = urgencyColors[urgencyLevel];

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background-color: ${color}; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">Translator Axis</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #111827; font-size: 24px;">${heading}</h2>
              <div style="color: #4b5563; font-size: 16px; line-height: 1.6;">
                ${message}
              </div>
              
              <!-- CTA Button -->
              <table role="presentation" style="margin: 30px 0;">
                <tr>
                  <td style="text-align: center;">
                    <a href="${ctaUrl}" style="display: inline-block; padding: 14px 32px; background-color: ${color}; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">${ctaText}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px; color: #6b7280; font-size: 14px;">
                <strong>Contact Us:</strong><br>
                Email: sales@translatoraxis.com<br>
                Website: <a href="${APP_URL}" style="color: ${color};">${APP_URL}</a>
              </p>
              <p style="margin: 10px 0 0; color: #9ca3af; font-size: 12px;">
                © ${new Date().getFullYear()} Translator Axis. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

// Styled HTML template for payment confirmed
function getStyledTemplate(data: OrderEmailData): string {
  const deliveryDate = data.estimatedDeliveryDate
    ? new Date(data.estimatedDeliveryDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'To be determined';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmed - ${data.orderNumber}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">Translator Axis</h1>
              <p style="margin: 10px 0 0; color: #d1fae5; font-size: 16px;">Professional Translation Services</p>
            </td>
          </tr>
          
          <!-- Success Message -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <div style="width: 64px; height: 64px; background-color: #d1fae5; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                <span style="color: #059669; font-size: 32px;">✓</span>
              </div>
              <h2 style="margin: 0 0 10px; color: #111827; font-size: 24px;">Payment Confirmed!</h2>
              <p style="margin: 0; color: #6b7280; font-size: 16px;">Thank you for your order${data.customerName ? `, ${data.customerName}` : ''}.</p>
            </td>
          </tr>
          
          <!-- Order Details -->
          <tr>
            <td style="padding: 0 40px 40px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f9fafb; border-radius: 6px; overflow: hidden;">
                <tr>
                  <td colspan="2" style="padding: 20px; background-color: #e5e7eb;">
                    <h3 style="margin: 0; color: #111827; font-size: 18px;">Order Details</h3>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 20px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">Order Number</td>
                  <td style="padding: 12px 20px; border-bottom: 1px solid #e5e7eb; color: #111827; font-weight: bold; font-size: 14px; text-align: right;">${data.orderNumber}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 20px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">Number of Documents</td>
                  <td style="padding: 12px 20px; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px; text-align: right;">${data.fileCount}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 20px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">Total Pages</td>
                  <td style="padding: 12px 20px; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px; text-align: right;">${data.totalPages}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 20px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">Amount Paid</td>
                  <td style="padding: 12px 20px; border-bottom: 1px solid #e5e7eb; color: #059669; font-weight: bold; font-size: 16px; text-align: right;">$${data.amount.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 20px; color: #6b7280; font-size: 14px;">Estimated Delivery</td>
                  <td style="padding: 12px 20px; color: #111827; font-weight: bold; font-size: 14px; text-align: right;">${deliveryDate}</td>
                </tr>
              </table>
              
              <!-- What's Next -->
              <div style="margin-top: 30px; padding: 20px; background-color: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 4px;">
                <h4 style="margin: 0 0 10px; color: #1e40af; font-size: 16px;">What happens next?</h4>
                <ul style="margin: 0; padding-left: 20px; color: #1e3a8a; font-size: 14px; line-height: 1.6;">
                  <li>Our professional translators will begin working on your documents</li>
                  <li>You can track your order status in your dashboard</li>
                  <li>We'll notify you when your translation is ready</li>
                  <li>Estimated completion: ${deliveryDate}</li>
                </ul>
              </div>
              
              <!-- View Order Button -->
              <table role="presentation" style="margin: 30px 0 0;">
                <tr>
                  <td style="text-align: center;">
                    <a href="${APP_URL}/user/orders/${data.orderId}" style="display: inline-block; padding: 14px 32px; background-color: #059669; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">View Order Status</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px; color: #6b7280; font-size: 14px;">
                <strong>Need Help?</strong><br>
                If you have any questions about your order, please don't hesitate to contact us.
              </p>
              <p style="margin: 10px 0; color: #6b7280; font-size: 14px;">
                Email: <a href="mailto:sales@translatoraxis.com" style="color: #059669;">sales@translatoraxis.com</a><br>
                Website: <a href="${APP_URL}" style="color: #059669;">${APP_URL}</a>
              </p>
              <p style="margin: 10px 0 0; color: #9ca3af; font-size: 12px;">
                © ${new Date().getFullYear()} Translator Axis. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

// Order Created Email
export function getOrderCreatedEmail(data: OrderEmailData): { subject: string; html: string } {
  const paymentUrl = `${APP_URL}/user/orders/${data.orderId}`;
  
  const message = `
    <p>Thank you for choosing Translator Axis! Your translation order has been created successfully.</p>
    
    <div style="background-color: #f9fafb; padding: 20px; border-radius: 6px; margin: 20px 0;">
      <p style="margin: 0 0 10px;"><strong>Order Number:</strong> ${data.orderNumber}</p>
      <p style="margin: 0 0 10px;"><strong>Documents:</strong> ${data.fileCount} file${data.fileCount !== 1 ? 's' : ''} (${data.totalPages} page${data.totalPages !== 1 ? 's' : ''})</p>
      <p style="margin: 0;"><strong>Amount Due:</strong> $${data.amount.toFixed(2)}</p>
    </div>
    
    <p><strong>Payment is required to begin processing your order.</strong> You can complete payment now using the button below, or later from your dashboard.</p>
    
    <p>Once payment is received, our professional translators will begin working on your documents immediately.</p>
    
    <div style="margin: 20px 0; padding: 15px; background-color: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 4px;">
      <p style="margin: 0; color: #1e40af; font-size: 14px;">
        💳 <strong>Payment Link:</strong><br>
        <a href="${paymentUrl}" style="color: #2563eb; word-break: break-all;">${paymentUrl}</a>
      </p>
    </div>
  `;

  return {
    subject: `Payment Required - Translation Order ${data.orderNumber}`,
    html: getSimpleTemplate(
      'Order Created',
      'Your Order Has Been Created',
      message,
      'Complete Payment Now',
      paymentUrl,
      'normal'
    ),
  };
}

// Payment Reminder Email
export function getPaymentReminderEmail(data: OrderEmailData): { subject: string; html: string } {
  const reminderNumber = data.reminderNumber || 1;
  const paymentUrl = `${APP_URL}/user/orders/${data.orderId}`;
  
  const urgencyMessages = {
    1: 'We noticed your order is still awaiting payment.',
    2: 'This is a friendly reminder that your translation order is still pending payment.',
    3: 'This is your final reminder - your order is still awaiting payment.',
  };

  const urgencyLevels: ('normal' | 'medium' | 'high')[] = ['normal', 'medium', 'high'];

  const message = `
    <p>${urgencyMessages[reminderNumber as 1 | 2 | 3]}</p>
    
    <div style="background-color: #f9fafb; padding: 20px; border-radius: 6px; margin: 20px 0;">
      <p style="margin: 0 0 10px;"><strong>Order Number:</strong> ${data.orderNumber}</p>
      <p style="margin: 0 0 10px;"><strong>Documents:</strong> ${data.fileCount} file${data.fileCount !== 1 ? 's' : ''} (${data.totalPages} page${data.totalPages !== 1 ? 's' : ''})</p>
      <p style="margin: 0;"><strong>Amount Due:</strong> $${data.amount.toFixed(2)}</p>
    </div>
    
    <p><strong>Complete your payment to start the translation process.</strong> Our professional translators are ready to work on your documents as soon as payment is received.</p>
    
    <div style="margin: 20px 0; padding: 15px; background-color: ${reminderNumber === 3 ? '#fef2f2' : '#eff6ff'}; border-left: 4px solid ${reminderNumber === 3 ? '#ef4444' : '#3b82f6'}; border-radius: 4px;">
      <p style="margin: 0; color: ${reminderNumber === 3 ? '#991b1b' : '#1e40af'}; font-size: 14px;">
        💳 <strong>Payment Link:</strong><br>
        <a href="${paymentUrl}" style="color: ${reminderNumber === 3 ? '#dc2626' : '#2563eb'}; word-break: break-all;">${paymentUrl}</a>
      </p>
    </div>
    
    ${reminderNumber === 3 ? '<p style="color: #dc2626;"><strong>Please note:</strong> If we don\'t receive payment soon, you may need to contact us to proceed with your order.</p>' : ''}
  `;

  return {
    subject: `Payment Reminder ${reminderNumber}/3 - Order ${data.orderNumber}`,
    html: getSimpleTemplate(
      'Payment Reminder',
      `Payment Reminder (${reminderNumber} of 3)`,
      message,
      'Pay Now',
      paymentUrl,
      urgencyLevels[reminderNumber - 1]
    ),
  };
}

// Final Notice Email
export function getFinalNoticeEmail(data: OrderEmailData): { subject: string; html: string } {
  const paymentUrl = `${APP_URL}/user/orders/${data.orderId}`;
  
  const message = `
    <p><strong>This is our final notice regarding your unpaid translation order.</strong></p>
    
    <div style="background-color: #fef2f2; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #ef4444;">
      <p style="margin: 0 0 10px; color: #991b1b;"><strong>Order Number:</strong> ${data.orderNumber}</p>
      <p style="margin: 0 0 10px; color: #991b1b;"><strong>Documents:</strong> ${data.fileCount} file${data.fileCount !== 1 ? 's' : ''} (${data.totalPages} page${data.totalPages !== 1 ? 's' : ''})</p>
      <p style="margin: 0; color: #991b1b;"><strong>Amount Due:</strong> $${data.amount.toFixed(2)}</p>
    </div>
    
    <p>We have sent you multiple reminders about completing payment for your order. Your order will remain in our system as unpaid.</p>
    
    <p><strong>To proceed with your translation:</strong></p>
    <ul style="color: #4b5563; line-height: 1.8;">
      <li>Complete payment using the link below or through your dashboard</li>
      <li>Or contact us at sales@translatoraxis.com for assistance</li>
    </ul>
    
    <div style="margin: 20px 0; padding: 15px; background-color: #fee2e2; border-left: 4px solid #dc2626; border-radius: 4px;">
      <p style="margin: 0; color: #7f1d1d; font-size: 14px;">
        💳 <strong>Payment Link:</strong><br>
        <a href="${paymentUrl}" style="color: #dc2626; word-break: break-all; font-weight: bold;">${paymentUrl}</a>
      </p>
    </div>
    
    <p>We're here to help if you have any questions or concerns about your order.</p>
  `;

  return {
    subject: `Final Notice - Payment Required for Order ${data.orderNumber}`,
    html: getSimpleTemplate(
      'Final Notice',
      'Final Payment Notice',
      message,
      'Complete Payment Now',
      paymentUrl,
      'high'
    ),
  };
}

// Payment Confirmed Email
export function getPaymentConfirmedEmail(data: OrderEmailData): { subject: string; html: string } {
  return {
    subject: `Order Confirmed - ${data.orderNumber}`,
    html: getStyledTemplate(data),
  };
}

// Quote Ready Email (for custom orders)
export function getQuoteReadyEmail(data: OrderEmailData): { subject: string; html: string } {
  const paymentUrl = `${APP_URL}/user/orders/${data.orderId}`;
  
  const message = `
    <p>Good news! We've reviewed your custom translation request and prepared a quote for you.</p>
    
    <div style="background-color: #f9fafb; padding: 20px; border-radius: 6px; margin: 20px 0;">
      <p style="margin: 0 0 10px;"><strong>Order Number:</strong> ${data.orderNumber}</p>
      <p style="margin: 0 0 10px;"><strong>Documents:</strong> ${data.fileCount} file${data.fileCount !== 1 ? 's' : ''} (${data.totalPages} page${data.totalPages !== 1 ? 's' : ''})</p>
      <p style="margin: 0;"><strong>Quote Amount:</strong> <span style="font-size: 24px; color: #059669;">$${data.amount.toFixed(2)}</span></p>
    </div>
    
    <p><strong>Ready to proceed?</strong> Complete payment using the button below to start the translation process. Our professional translators will begin working on your documents as soon as payment is received.</p>
    
    <div style="margin: 20px 0; padding: 15px; background-color: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 4px;">
      <p style="margin: 0; color: #1e40af; font-size: 14px;">
        💳 <strong>Payment Link:</strong><br>
        <a href="${paymentUrl}" style="color: #2563eb; word-break: break-all;">${paymentUrl}</a>
      </p>
    </div>
    
    <p>If you have any questions about the quote or need adjustments, please don't hesitate to contact us at sales@translatoraxis.com.</p>
  `;

  return {
    subject: `Your Custom Translation Quote is Ready - ${data.orderNumber}`,
    html: getSimpleTemplate(
      'Quote Ready',
      'Your Custom Quote is Ready',
      message,
      'Review Quote & Pay',
      paymentUrl,
      'normal'
    ),
  };
}

// Main function to get email by kind
export function getEmailTemplate(kind: EmailKind, data: OrderEmailData): { subject: string; html: string } {
  switch (kind) {
    case 'order_created':
      return getOrderCreatedEmail(data);
    case 'payment_reminder':
      return getPaymentReminderEmail(data);
    case 'final_notice':
      return getFinalNoticeEmail(data);
    case 'payment_confirmed':
      return getPaymentConfirmedEmail(data);
    case 'quote_ready':
      return getQuoteReadyEmail(data);
    default:
      throw new Error(`Unknown email kind: ${kind}`);
  }
}

