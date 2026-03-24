const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// ---------------------------------------------------------------------------
// CORS — allow requests from the Next.js frontend
// ---------------------------------------------------------------------------
app.use(
  cors({
    origin: [
      FRONTEND_URL,
      'http://localhost:3000',
      // Railway internal networking (same project)
      /\.railway\.internal$/,
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ---------------------------------------------------------------------------
// Static file serving — converted/merged output files
// ---------------------------------------------------------------------------
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------
const convertRouter = require('./routes/convert');
const mergeRouter = require('./routes/merge');

app.use('/api/convert', convertRouter);
app.use('/api/merge', mergeRouter);

// ---------------------------------------------------------------------------
// GET /api/status/:id
// Check whether a converted/merged file is still available for download.
// ---------------------------------------------------------------------------
app.get('/api/status/:id', (req, res) => {
  const { id } = req.params;
  if (!id || !/^[\w-]+$/.test(id)) {
    return res.status(400).json({ error: 'Invalid job ID' });
  }

  // Look for any file in uploads/ whose name starts with the job ID
  let found = null;
  try {
    const files = fs.readdirSync(uploadsDir);
    const match = files.find((f) => f.startsWith(id));
    if (match) {
      found = {
        id,
        status: 'ready',
        result: {
          downloadUrl: `/uploads/${match}`,
          filename: match,
        },
      };
    }
  } catch {
    // uploads dir may not exist yet
  }

  if (found) return res.json(found);
  return res.status(404).json({ id, status: 'not_found', error: 'Job not found or file already deleted' });
});

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'pdfoasis-backend',
    timestamp: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------
app.get('/', (_req, res) => {
  res.json({
    message: 'PDFOasis Backend API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      convert: 'POST /api/convert',
      merge: 'POST /api/merge',
      status: 'GET /api/status/:id',
    },
  });
});

// ---------------------------------------------------------------------------
// 404 & error handlers
// ---------------------------------------------------------------------------
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`PDFOasis backend running on port ${PORT}`);
  console.log(`Accepting requests from: ${FRONTEND_URL}`);
});
