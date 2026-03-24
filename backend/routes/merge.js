const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// ---------------------------------------------------------------------------
// Storage
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
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') return cb(null, true);
    cb(new Error('Only PDF files are accepted'));
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function scheduleCleanup(filePath, delayMs = 5 * 60 * 1000) {
  setTimeout(() => fs.unlink(filePath, () => {}), delayMs);
}

// ---------------------------------------------------------------------------
// POST /api/merge
// ---------------------------------------------------------------------------
router.post('/', upload.array('files', 10), async (req, res) => {
  const files = req.files;

  if (!files || files.length < 2) {
    (files || []).forEach((f) => fs.unlink(f.path, () => {}));
    return res.status(400).json({ error: 'Please upload at least 2 PDF files to merge' });
  }

  let pdfLib;
  try {
    pdfLib = require('pdf-lib');
  } catch {
    files.forEach((f) => fs.unlink(f.path, () => {}));
    return res.status(501).json({
      error: 'pdf-lib is not installed on the backend. Install it with: npm install pdf-lib',
    });
  }

  const { PDFDocument } = pdfLib;
  const jobId = uuidv4();

  try {
    const mergedDoc = await PDFDocument.create();

    for (const file of files) {
      const bytes = fs.readFileSync(file.path);
      const srcDoc = await PDFDocument.load(bytes);
      const copiedPages = await mergedDoc.copyPages(srcDoc, srcDoc.getPageIndices());
      copiedPages.forEach((page) => mergedDoc.addPage(page));
    }

    const mergedBytes = await mergedDoc.save();
    const outputFilename = `${jobId}_merged.pdf`;
    const outputPath = path.join(uploadsDir, outputFilename);
    fs.writeFileSync(outputPath, mergedBytes);

    // Cleanup inputs and output
    files.forEach((f) => scheduleCleanup(f.path));
    scheduleCleanup(outputPath);

    return res.json({
      jobId,
      downloadUrl: `/uploads/${outputFilename}`,
      filename: outputFilename,
      message: `Merged ${files.length} PDFs into one (${(mergedBytes.length / 1024).toFixed(0)} KB)`,
    });
  } catch (err) {
    console.error('[merge] error:', err);
    files.forEach((f) => fs.unlink(f.path, () => {}));
    return res.status(500).json({ error: err.message || 'Merge failed' });
  }
});

module.exports = router;
