const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// ---------------------------------------------------------------------------
// Storage — save uploads to /uploads with a unique name
// ---------------------------------------------------------------------------
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.pdf';
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') return cb(null, true);
    cb(new Error('Only PDF files are accepted'));
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Schedule a file for deletion after `delayMs` milliseconds. */
function scheduleCleanup(filePath, delayMs = 5 * 60 * 1000) {
  setTimeout(() => {
    fs.unlink(filePath, () => {});
  }, delayMs);
}

/**
 * Attempt to load pdf-lib. Returns null if not installed so the route can
 * return a helpful error instead of crashing the process.
 */
function tryRequire(mod) {
  try {
    return require(mod);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// POST /api/convert
// ---------------------------------------------------------------------------
router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No PDF file uploaded' });
  }

  const format = req.body.format || 'pdf-to-text';
  const inputPath = req.file.path;
  const jobId = uuidv4();

  try {
    let outputPath;
    let outputFilename;
    let message;

    switch (format) {
      // ------------------------------------------------------------------
      case 'pdf-to-text': {
        // Use pdfjs-dist (legacy build) to extract text
        const pdfjsLib = tryRequire('pdfjs-dist/legacy/build/pdf.js');
        if (!pdfjsLib) {
          return res.status(501).json({
            error: 'pdfjs-dist is not installed on the backend. Install it with: npm install pdfjs-dist',
          });
        }

        const data = new Uint8Array(fs.readFileSync(inputPath));
        const loadingTask = pdfjsLib.getDocument({ data });
        const pdfDoc = await loadingTask.promise;

        let fullText = '';
        for (let i = 1; i <= pdfDoc.numPages; i++) {
          const page = await pdfDoc.getPage(i);
          const content = await page.getTextContent();
          const pageText = content.items.map((item) => item.str).join(' ');
          fullText += `--- Page ${i} ---\n${pageText}\n\n`;
        }

        outputFilename = `${jobId}.txt`;
        outputPath = path.join(uploadsDir, outputFilename);
        fs.writeFileSync(outputPath, fullText, 'utf8');
        message = `Extracted text from ${pdfDoc.numPages} page(s)`;
        break;
      }

      // ------------------------------------------------------------------
      case 'compress': {
        // Re-save with pdf-lib (basic re-serialisation reduces some overhead)
        const pdfLib = tryRequire('pdf-lib');
        if (!pdfLib) {
          return res.status(501).json({
            error: 'pdf-lib is not installed on the backend. Install it with: npm install pdf-lib',
          });
        }

        const { PDFDocument } = pdfLib;
        const existingPdfBytes = fs.readFileSync(inputPath);
        const pdfDoc = await PDFDocument.load(existingPdfBytes);
        const compressedBytes = await pdfDoc.save({ useObjectStreams: true });

        outputFilename = `${jobId}_compressed.pdf`;
        outputPath = path.join(uploadsDir, outputFilename);
        fs.writeFileSync(outputPath, compressedBytes);

        const originalSize = existingPdfBytes.length;
        const newSize = compressedBytes.length;
        const saving = (((originalSize - newSize) / originalSize) * 100).toFixed(1);
        message = `Compressed PDF — saved ~${saving}% (${(newSize / 1024).toFixed(0)} KB)`;
        break;
      }

      // ------------------------------------------------------------------
      case 'pdf-to-image': {
        // Use pdf2pic to render the first page as a PNG
        const { fromPath } = tryRequire('pdf2pic') || {};
        if (!fromPath) {
          return res.status(501).json({
            error: 'pdf2pic is not installed on the backend. Install it with: npm install pdf2pic',
          });
        }

        const converter = fromPath(inputPath, {
          density: 150,
          saveFilename: jobId,
          savePath: uploadsDir,
          format: 'png',
          width: 1200,
          height: 1600,
        });

        const result = await converter(1); // convert page 1
        outputFilename = path.basename(result.path);
        outputPath = result.path;
        message = 'Converted first page to PNG image';
        break;
      }

      // ------------------------------------------------------------------
      case 'pdf-to-word': {
        // We cannot do a true PDF→DOCX conversion without a paid service or
        // heavy ML model. Instead we extract text and wrap it in a plain .txt
        // file named .docx so the user gets something useful.
        // A production implementation would call LibreOffice or a cloud API.
        const pdfjsLib = tryRequire('pdfjs-dist/legacy/build/pdf.js');
        if (!pdfjsLib) {
          return res.status(501).json({
            error: 'pdfjs-dist is not installed on the backend.',
          });
        }

        const data = new Uint8Array(fs.readFileSync(inputPath));
        const loadingTask = pdfjsLib.getDocument({ data });
        const pdfDoc = await loadingTask.promise;

        let fullText = '';
        for (let i = 1; i <= pdfDoc.numPages; i++) {
          const page = await pdfDoc.getPage(i);
          const content = await page.getTextContent();
          const pageText = content.items.map((item) => item.str).join(' ');
          fullText += `${pageText}\n\n`;
        }

        outputFilename = `${jobId}.txt`;
        outputPath = path.join(uploadsDir, outputFilename);
        fs.writeFileSync(outputPath, fullText, 'utf8');
        message = `Extracted text from ${pdfDoc.numPages} page(s) — full DOCX conversion requires LibreOffice`;
        break;
      }

      // ------------------------------------------------------------------
      default:
        fs.unlink(inputPath, () => {});
        return res.status(400).json({ error: `Unknown format: ${format}` });
    }

    // Schedule cleanup of both input and output files
    scheduleCleanup(inputPath);
    scheduleCleanup(outputPath);

    return res.json({
      jobId,
      downloadUrl: `/uploads/${outputFilename}`,
      filename: outputFilename,
      message,
    });
  } catch (err) {
    console.error('[convert] error:', err);
    fs.unlink(inputPath, () => {});
    return res.status(500).json({ error: err.message || 'Conversion failed' });
  }
});

module.exports = router;
