# Translation Order System

## Overview

The order system allows users to upload documents/images, calculate pricing ($35 per page), process payments via PayPal, and track orders in their dashboard.

## Features Implemented

### 1. File Upload
- Drag & drop or click to upload multiple files
- Supports PDF and images (PNG, JPG, JPEG, GIF, WEBP)
- Shows file count and page count
- File size display

### 2. Pricing Calculation
- $35 per page
- Automatic calculation based on uploaded files
- Page count estimation:
  - PDFs: ~1 page per 50KB
  - Images: 1 page each

### 3. Order Creation
- Creates order in Convex database
- Generates unique order number
- Sets estimated delivery date (7 days from order)

### 4. PayPal Integration
- PayPal payment button
- Payment processing
- Order status update after payment

### 5. Email Confirmation
- Order confirmation email (needs email service integration)
- Includes order details and delivery estimate

### 6. Orders Dashboard
- View all orders
- Order status tracking
- Order details (files, pages, amount, delivery date)

## File Structure

```
app/
├── (dashboard)/user/
│   ├── new-order/page.tsx      # New order page
│   └── page.tsx                 # User dashboard
├── api/
│   ├── upload/route.ts          # File upload API
│   ├── paypal/
│   │   ├── create-order/route.ts
│   │   └── capture-order/route.ts
│   └── send-order-confirmation/route.ts

components/
├── orders/
│   ├── file-upload.tsx          # File upload component
│   ├── new-order-form.tsx       # Order form with pricing
│   └── paypal-button.tsx        # PayPal payment button
└── dashboards/
    └── user-dashboard.tsx       # Updated with orders tab

convex/
├── schema.ts                    # Orders table schema
└── orders.ts                    # Order queries/mutations
```

## Setup Required

### 1. PayPal Configuration

Add to `.env.local`:
```env
NEXT_PUBLIC_PAYPAL_CLIENT_ID=your_paypal_client_id
```

Get your PayPal Client ID from:
- PayPal Developer Dashboard: https://developer.paypal.com
- Create a new app
- Copy the Client ID

**Note**: Current implementation uses mock PayPal endpoints. For production, integrate with PayPal SDK:
- Install: `npm install @paypal/checkout-server-sdk`
- Update `/api/paypal/create-order` and `/api/paypal/capture-order` routes

### 2. Email Service Configuration

The email sending is currently mocked. For production, integrate with an email service:

**Option A: Resend (Recommended)**
```bash
npm install resend
```

Update `/app/api/send-order-confirmation/route.ts`:
```typescript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

await resend.emails.send({
  from: 'orders@yourdomain.com',
  to: email,
  subject: 'Translation Order Confirmation',
  html: `<h1>Order Confirmed</h1><p>Your order ${orderId}...</p>`,
});
```

**Option B: SendGrid**
```bash
npm install @sendgrid/mail
```

**Option C: Nodemailer**
```bash
npm install nodemailer
```

### 3. File Storage

Currently, files are stored as base64 data URLs (not production-ready). For production:

**Option A: Cloudinary**
```bash
npm install cloudinary
```

**Option B: AWS S3**
```bash
npm install @aws-sdk/client-s3
```

**Option C: Uploadthing**
```bash
npm install uploadthing @uploadthing/react
```

Update `/app/api/upload/route.ts` to upload to your storage service.

## Order Flow

1. **User navigates to** `/user/new-order`
2. **Uploads files** via drag & drop or file picker
3. **Sees pricing** calculated automatically ($35 per page)
4. **Clicks "Proceed to Payment"** → Creates order in database
5. **Completes PayPal payment** → Updates order status to "paid"
6. **Receives email confirmation** → Order details and 7-day delivery estimate
7. **Views orders** in `/user` dashboard → Orders tab

## Order Statuses

- `pending` - Order created, payment not completed
- `paid` - Payment completed
- `processing` - Order being processed
- `completed` - Translation completed
- `cancelled` - Order cancelled

## Database Schema

### Orders Table
- `userId` - Reference to user
- `clerkId` - Clerk user ID
- `orderNumber` - Unique order identifier
- `files` - Array of file objects
- `totalPages` - Total pages across all files
- `amount` - Total amount in USD
- `status` - Order status
- `paymentId` - PayPal transaction ID
- `paymentStatus` - PayPal payment status
- `estimatedDeliveryDate` - Timestamp (7 days from order)
- `createdAt` - Order creation timestamp
- `updatedAt` - Last update timestamp

## API Routes

### POST `/api/upload`
- Uploads files
- Returns file metadata with page counts
- **Auth**: Requires Clerk authentication

### POST `/api/paypal/create-order`
- Creates PayPal order
- Returns PayPal order ID
- **Auth**: Requires Clerk authentication

### POST `/api/paypal/capture-order`
- Captures PayPal payment
- Updates order status
- **Auth**: Requires Clerk authentication

### POST `/api/send-order-confirmation`
- Sends order confirmation email
- **Auth**: Requires Clerk authentication

## Convex Functions

### Mutations
- `createOrder` - Create new order
- `updateOrderPayment` - Update payment status
- `updateOrderStatus` - Update order status (admin only)

### Queries
- `getUserOrders` - Get orders for a user
- `getOrderById` - Get specific order
- `getAllOrders` - Get all orders (admin only)

## Testing

1. **Sign in** as a user
2. **Navigate to** `/user/new-order`
3. **Upload files** (PDF or images)
4. **Verify pricing** calculation
5. **Create order** (click "Proceed to Payment")
6. **Complete payment** (PayPal sandbox)
7. **Check email** (check console logs for now)
8. **View orders** in dashboard Orders tab

## Production Checklist

- [ ] Configure PayPal Client ID
- [ ] Integrate real PayPal SDK
- [ ] Set up email service (Resend/SendGrid)
- [ ] Set up file storage (Cloudinary/S3)
- [ ] Add file size limits
- [ ] Add file type validation
- [ ] Add error handling
- [ ] Add loading states
- [ ] Add order cancellation
- [ ] Add order tracking
- [ ] Add admin order management
- [ ] Add email templates
- [ ] Add payment webhooks for security

## Notes

- Current file upload stores files as base64 (not scalable)
- PayPal integration is mocked (needs real SDK)
- Email sending is logged to console (needs email service)
- Page count estimation is approximate (may need PDF parsing library)
- Order numbers are generated using timestamp + random string

