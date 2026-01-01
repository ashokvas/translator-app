# Email System Setup Guide

## Overview

The application uses **Nodemailer** with **GoDaddy SMTP** to send transactional emails for order confirmations and payment reminders.

---

## Required Environment Variables

Add these to your `.env.local` file:

```env
# Email Configuration (GoDaddy SMTP)
SMTP_HOST=smtpout.secureserver.net
SMTP_PORT=465
SMTP_USER=sales@translatoraxis.com
SMTP_PASSWORD=your_godaddy_email_password
SMTP_FROM_NAME=Translator Axis

# Application URL (for email links)
NEXT_PUBLIC_APP_URL=https://translatoraxis.com
```

---

## Email Types

The system sends 4 types of emails:

### 1. Order Created (`order_created`)
- **Trigger:** When customer creates an order
- **Style:** Simple HTML
- **Content:** Order details, amount due, payment link

### 2. Payment Reminder (`payment_reminder`)
- **Trigger:** Automated via Convex cron (every 2 days, up to 3 times)
- **Style:** Simple HTML with escalating urgency
- **Content:** Reminder 1/2/3, order details, payment link

### 3. Final Notice (`final_notice`)
- **Trigger:** Automated via Convex cron (2 days after 3rd reminder)
- **Style:** Simple HTML with high urgency
- **Content:** Final reminder, order stays pending for admin review

### 4. Payment Confirmed (`payment_confirmed`)
- **Trigger:** When customer completes payment
- **Style:** Styled HTML with professional design
- **Content:** Thank you message, full order details, estimated delivery

---

## Payment Reminder Timeline

| Day | Action |
|-----|--------|
| 0 | Order created → "Order Created" email sent |
| 2 | 1st payment reminder sent automatically |
| 4 | 2nd payment reminder sent automatically |
| 6 | 3rd payment reminder sent automatically |
| 8 | Final notice sent automatically |
| - | Order remains pending (admin can manually delete) |

---

## Automated Reminders (Convex Cron)

The system uses Convex cron jobs to automatically send payment reminders:

- **Schedule:** Daily at 9:00 AM UTC
- **File:** `convex/crons.ts`
- **Action:** `convex/orders.ts` → `processPaymentReminders`

### How It Works

1. Cron job runs daily
2. Queries all pending orders via `getPendingOrdersForReminders`
3. Filters orders that need action (2 days since last reminder)
4. Sends appropriate email (reminder 1/2/3 or final notice)
5. Updates order tracking fields (`reminderCount`, `lastReminderSentAt`, `finalNoticeSentAt`)

---

## Testing Email Locally

### 1. Set Environment Variables

Create `.env.local` with your GoDaddy SMTP credentials:

```env
SMTP_HOST=smtpout.secureserver.net
SMTP_PORT=465
SMTP_USER=sales@translatoraxis.com
SMTP_PASSWORD=your_actual_password
SMTP_FROM_NAME=Translator Axis
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 2. Test Email Sending

You can test the email system by creating an order:

1. Start the dev server: `npm run dev`
2. Sign in as a user
3. Go to `/user/new-order`
4. Upload files and create an order
5. Check your email inbox for the "Order Created" email

### 3. Verify SMTP Connection

To verify your SMTP connection works, you can add this to your code temporarily:

```typescript
import { verifyEmailConnection } from '@/lib/email';

// In an API route or server component
const isConnected = await verifyEmailConnection();
console.log('SMTP connection:', isConnected ? 'Success' : 'Failed');
```

---

## Production Deployment

### 1. Add Environment Variables

In your production environment (Vercel, Railway, etc.), add:

```
SMTP_HOST=smtpout.secureserver.net
SMTP_PORT=465
SMTP_USER=sales@translatoraxis.com
SMTP_PASSWORD=your_godaddy_password
SMTP_FROM_NAME=Translator Axis
NEXT_PUBLIC_APP_URL=https://translatoraxis.com
```

### 2. Deploy Convex Cron Jobs

Convex cron jobs are automatically deployed when you push to Convex:

```bash
npx convex deploy
```

The cron job will start running automatically at the scheduled time (9:00 AM UTC daily).

### 3. Monitor Email Logs

Check your application logs for email sending status:

```
Email sent successfully: order_created for order TRANS-XXX to customer@example.com
Reminder 1 sent for order TRANS-XXX
Final notice sent for order TRANS-XXX
```

---

## Troubleshooting

### Email Not Sending

1. **Check SMTP credentials:** Verify `SMTP_USER` and `SMTP_PASSWORD` are correct
2. **Check GoDaddy settings:** Ensure SMTP is enabled for your email account
3. **Check logs:** Look for error messages in console/logs
4. **Test connection:** Use `verifyEmailConnection()` helper

### Cron Job Not Running

1. **Check Convex deployment:** Run `npx convex deploy`
2. **Check cron schedule:** Verify in Convex dashboard
3. **Check logs:** View cron execution logs in Convex dashboard

### Wrong Email Template

1. **Check email kind:** Ensure correct `kind` parameter is passed
2. **Check order data:** Verify all required fields are provided
3. **Check template logic:** Review `lib/email-templates.ts`

---

## File Structure

```
lib/
├── email.ts                    # SMTP configuration and sendEmail helper
└── email-templates.ts          # HTML email templates

app/api/
└── send-order-confirmation/
    └── route.ts                # Email sending API route

convex/
├── crons.ts                    # Cron job definitions
├── orders.ts                   # Order mutations/queries + processPaymentReminders action
└── schema.ts                   # Schema with reminder tracking fields

components/
├── orders/
│   ├── new-order-form.tsx      # Sends order_created email
│   └── paypal-button.tsx       # Sends payment_confirmed email
└── admin/
    └── admin-order-form.tsx    # Sends order_created email (admin creates for client)
```

---

## Security Notes

1. **Never commit `.env.local`** - It contains sensitive credentials
2. **Use environment variables** - Never hardcode passwords in code
3. **Secure SMTP credentials** - Store securely in production environment
4. **Rate limiting** - Consider adding rate limiting to email API route
5. **Email validation** - Always validate email addresses before sending

---

## Support

For issues with:
- **GoDaddy SMTP:** Contact GoDaddy support
- **Email templates:** Check `lib/email-templates.ts`
- **Cron jobs:** Check Convex dashboard and logs
- **Application logic:** Review relevant component files

