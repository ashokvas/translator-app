const express = require('express');
const multer = require('multer');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const PDFParse = require('pdf-parse');

const app = express();
const upload = multer({ dest: '/tmp/uploads/' });

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'libreoffice-service',
    timestamp: new Date().toISOString()
  });
});

// Count pages in office document
app.post('/count-pages', upload.single('file'), async (req, res) => {
  let tempPdfPath = null;
  let inputPath = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    inputPath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();
    
    // Validate file type
    if (!['.docx', '.xlsx', '.doc', '.xls'].includes(ext)) {
      return res.status(400).json({ 
        error: 'Unsupported file type',
        supportedTypes: ['.docx', '.xlsx', '.doc', '.xls']
      });
    }

    console.log(`Processing file: ${req.file.originalname} (${ext})`);

    // Convert to PDF using LibreOffice
    const outputDir = os.tmpdir();
    const baseName = path.basename(inputPath);
    tempPdfPath = path.join(outputDir, `${baseName}.pdf`);
    
    await new Promise((resolve, reject) => {
      const libreoffice = spawn('soffice', [
        '--headless',
        '--nologo',
        '--nolockcheck',
        '--nodefault',
        '--nofirststartwizard',
        '--convert-to',
        'pdf',
        '--outdir',
        outputDir,
        inputPath,
      ], { stdio: ['ignore', 'pipe', 'pipe'] });

      let stderr = '';
      let stdout = '';

      libreoffice.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      libreoffice.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      libreoffice.on('error', (err) => {
        reject(new Error(`Failed to spawn LibreOffice: ${err.message}`));
      });

      libreoffice.on('close', (code) => {
        if (code === 0) {
          console.log('LibreOffice conversion successful');
          resolve();
        } else {
          reject(new Error(`LibreOffice exited with code ${code}. stderr: ${stderr}, stdout: ${stdout}`));
        }
      });
    });

    // Read the converted PDF
    const pdfBuffer = await fs.readFile(tempPdfPath);
    
    // Count pages using pdf-parse
    const pdfData = await PDFParse(pdfBuffer);
    let pageCount = pdfData.numpages;

    console.log(`Initial page count: ${pageCount}`);

    // Check if last page is blank (common LibreOffice issue)
    if (pageCount > 1) {
      const pages = pdfData.text.split('\f'); // Form feed character separates pages
      const lastPageText = pages[pages.length - 1] || '';
      
      if (lastPageText.trim().length < 50) {
        console.log('Detected blank last page, adjusting count');
        pageCount--;
      }
    }

    console.log(`Final page count: ${pageCount}`);

    // Cleanup
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(tempPdfPath).catch(() => {});

    res.json({ 
      pageCount,
      fileName: req.file.originalname,
      processedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error processing file:', error);
    
    // Cleanup on error
    try {
      if (inputPath) await fs.unlink(inputPath).catch(() => {});
      if (tempPdfPath) await fs.unlink(tempPdfPath).catch(() => {});
    } catch {}

    res.status(500).json({ 
      error: 'Failed to process document',
      message: error.message,
      details: error.stack
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 LibreOffice service running on port ${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`   Endpoint: POST http://localhost:${PORT}/count-pages`);
});


