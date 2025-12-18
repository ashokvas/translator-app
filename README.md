# Translation Service App

A modern, full-stack translation service platform built with Next.js 16, featuring role-based access control, automated document processing, and Google Cloud Translation API integration.

## 🌟 Features

### For Users
- 📤 Upload multiple files (PDF, DOCX, XLSX, images)
- 🌍 Select from 25+ European languages
- 💰 Automatic pricing calculation ($35/page)
- 💳 Secure PayPal payment integration
- 📧 Email notifications
- 📊 Order tracking dashboard
- ⬇️ Download translated documents

### For Admins
- 👥 User management (create, edit users)
- 📋 Order management (view all orders)
- 🔄 Translation workflow (translate, review, edit)
- ✅ Approve and generate final documents
- 📊 Order status tracking

## 🛠️ Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript
- **Authentication**: Clerk
- **Database**: Convex (BaaS)
- **Translation**: Google Cloud Translation API v2 + Vision API (OCR)
- **Payments**: PayPal
- **Styling**: Tailwind CSS, shadcn/ui
- **File Processing**: LibreOffice, pdf-parse, pdfjs-dist, docx

## 📁 Project Structure

```
translator-app/
├── app/                          # Next.js App Router
│   ├── (auth)/                  # Authentication pages
│   ├── (dashboard)/             # Dashboard pages (user & admin)
│   └── api/                     # API routes
├── components/                   # React components
│   ├── admin/                   # Admin-specific components
│   ├── dashboards/              # Dashboard components
│   ├── orders/                  # Order management components
│   ├── providers/               # Context providers
│   └── ui/                      # Reusable UI components (shadcn)
├── convex/                      # Convex backend functions
│   ├── schema.ts               # Database schema
│   ├── users.ts                # User functions
│   ├── orders.ts               # Order functions
│   ├── translations.ts         # Translation functions
│   └── files.ts                # File storage functions
├── lib/                         # Utility functions
├── libreoffice-service/         # Microservice for Office docs
└── public/                      # Static assets

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- LibreOffice (for local development)
- Clerk account
- Convex account
- Google Cloud account (Translation & Vision APIs)
- PayPal developer account

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/ashokvas/translator-app.git
   cd translator-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Fill in your API keys in `.env.local`

4. **Install LibreOffice** (macOS)
   ```bash
   brew install --cask libreoffice
   # or download from https://www.libreoffice.org/download/
   ```

5. **Start Convex**
   ```bash
   npx convex dev
   ```

6. **Start development server** (new terminal)
   ```bash
   npm run dev
   ```

7. **Open your browser**
   ```
   http://localhost:3000
   ```

## 📚 Documentation

- **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** - Comprehensive deployment instructions
- **[QUICK_DEPLOY.md](./QUICK_DEPLOY.md)** - Quick reference for deployment
- **[DEVELOPMENT_NOTES.md](./DEVELOPMENT_NOTES.md)** - Technical documentation
- **[TRANSLATION_SYSTEM.md](./TRANSLATION_SYSTEM.md)** - Translation workflow details
- **[EDIT_ROLE_GUIDE.md](./EDIT_ROLE_GUIDE.md)** - How to manage user roles

## 🌐 Deployment

### Recommended: Vercel + Railway

**Main App → Vercel** (serverless, auto-scaling)  
**LibreOffice Service → Railway** (containerized microservice)

See [QUICK_DEPLOY.md](./QUICK_DEPLOY.md) for step-by-step instructions.

### Quick Deploy Commands

```bash
# Deploy to Vercel
vercel

# Deploy LibreOffice service to Railway
# (via Railway dashboard - connect GitHub repo)
```

## 🔑 Environment Variables

See `.env.example` for all required variables:

- Clerk (authentication)
- Convex (database)
- Google Cloud (translation/OCR)
- PayPal (payments)
- LibreOffice (document processing)

## 🧪 Testing

```bash
# Run linter
npm run lint

# Build for production (test)
npm run build

# Start production server
npm start
```

## 📦 Key Features Implementation

### File Upload System
- Drag-and-drop interface
- Multiple file types (PDF, DOCX, XLSX, images)
- Real-time progress tracking
- Accurate page counting (including LibreOffice conversion)
- 10MB file size limit

### Translation Workflow
1. Admin clicks "View & Translate" on order
2. Click "Translate" for each file
3. System processes with Google Cloud APIs
4. Side-by-side review interface
5. Edit translations in-place
6. Approve and generate Word document
7. Client downloads from dashboard

### Payment Integration
- PayPal Smart Payment Buttons
- Order creation without immediate payment
- Payment reminders via email
- Automatic order status updates

### Role-Based Access Control
- **Users**: Create orders, view their orders, make payments
- **Admins**: Manage users, view all orders, translate documents

## 🔒 Security

- Environment variables for all secrets
- Clerk authentication
- Role-based authorization
- File type validation
- File size limits
- HTTPS (in production)

## 💰 Pricing

**User Orders**: $35 per page
- Calculated automatically based on document page count
- Displayed before payment
- PayPal integration for secure payments

## 📧 Email Notifications

- Order confirmation
- Payment required reminders
- Order status updates
- 7-day delivery estimate

## 🛠️ Troubleshooting

### LibreOffice not found
```bash
# macOS
brew install --cask libreoffice

# Set path in .env.local
LIBREOFFICE_PATH=/Applications/LibreOffice.app/Contents/MacOS/soffice
```

### Translation fails
- Verify Google Cloud billing is enabled
- Check API keys in `.env.local`
- Confirm Translation & Vision APIs are enabled

### File upload fails
- Check Convex is running (`npx convex dev`)
- Verify file size < 10MB
- Check file type is supported

## 📈 Roadmap

- [ ] Email service integration (Resend/SendGrid)
- [ ] PDF format preservation in translations
- [ ] Batch translation
- [ ] Translation memory
- [ ] Real-time notifications
- [ ] Admin analytics dashboard
- [ ] Multiple export formats

## 🤝 Contributing

This is a private project. For questions or issues, contact the developer.

## 📄 License

Proprietary - All rights reserved

## 🙏 Acknowledgments

- Next.js team for the amazing framework
- Clerk for authentication
- Convex for backend infrastructure
- Google Cloud for translation APIs
- shadcn for beautiful UI components

## 📞 Support

For deployment help, see:
- [QUICK_DEPLOY.md](./QUICK_DEPLOY.md)
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

For development help, see:
- [DEVELOPMENT_NOTES.md](./DEVELOPMENT_NOTES.md)

---

**Built with ❤️ using Next.js 16, React 19, and modern web technologies**
