# LibreOffice Microservice

A lightweight Node.js microservice for processing Office documents (DOCX, XLSX) and counting pages accurately.

## Features

- Converts Office documents to PDF using LibreOffice headless
- Counts pages accurately (handles blank pages)
- RESTful API
- Docker support
- Health check endpoint

## Local Development

### Prerequisites

- Node.js 18+
- LibreOffice installed

### Installation

```bash
npm install
```

### Run Locally

```bash
npm start
```

Service will be available at `http://localhost:3001`

### Test

```bash
# Health check
curl http://localhost:3001/health

# Count pages
curl -X POST -F "file=@test.docx" http://localhost:3001/count-pages
```

## Docker Deployment

### Build Image

```bash
docker build -t libreoffice-service .
```

### Run Container

```bash
docker run -p 3001:3001 libreoffice-service
```

## Deploy to Railway

1. Create account at https://railway.app
2. Create new project → "Deploy from GitHub repo"
3. Connect this repository
4. Railway will auto-detect Dockerfile and deploy
5. Get your service URL (e.g., `https://your-service.railway.app`)

## Deploy to Render

1. Create account at https://render.com
2. New → Web Service
3. Connect GitHub repository
4. Select "Docker" as environment
5. Deploy

## API Endpoints

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "service": "libreoffice-service",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### POST /count-pages

Count pages in an Office document.

**Request:**
- Method: POST
- Content-Type: multipart/form-data
- Body: `file` (DOCX or XLSX file)

**Response:**
```json
{
  "pageCount": 25,
  "fileName": "document.docx",
  "processedAt": "2024-01-01T00:00:00.000Z"
}
```

**Error Response:**
```json
{
  "error": "Failed to process document",
  "message": "Error details here"
}
```

## Environment Variables

- `PORT` - Port to run the service on (default: 3001)

## Supported File Types

- `.docx` - Microsoft Word (OpenXML)
- `.xlsx` - Microsoft Excel (OpenXML)
- `.doc` - Microsoft Word (Legacy)
- `.xls` - Microsoft Excel (Legacy)

## Architecture

```
Client → Upload DOCX/XLSX
         ↓
    LibreOffice Service
         ↓
    Convert to PDF (LibreOffice headless)
         ↓
    Count Pages (pdf-parse)
         ↓
    Return page count
```

## Notes

- Files are processed in `/tmp/uploads/` and cleaned up after processing
- LibreOffice sometimes adds blank pages - the service detects and adjusts for this
- Maximum file size depends on your hosting platform
- Processing time depends on document complexity (typically 1-5 seconds)

## Troubleshooting

### LibreOffice not found
Ensure LibreOffice is installed in the container. The Dockerfile includes installation steps.

### Conversion fails
Check that the uploaded file is a valid Office document and not corrupted.

### Out of memory
Increase container memory allocation. Large documents may require more RAM.

## License

MIT

