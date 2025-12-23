const express = require('express');
const router = express.Router();
const multer = require('multer');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { authMiddleware } = require('../middleware/authMiddleware');

// Temporary upload location
const uploadDir = os.tmpdir();
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safeName = `upload-${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    cb(null, safeName);
  }
});
const upload = multer({ storage });

/**
 * POST /api/recordings/convert
 * Accepts a single file (field name 'file'), transcodes to MP4 (H.264 + AAC) using ffmpeg,
 * and returns the converted file as attachment.
 * NOTE: This endpoint requires ffmpeg available on the server PATH.
 */
router.post('/convert', authMiddleware, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  const inputPath = req.file.path;
  const outputFilename = path.basename(req.file.filename, path.extname(req.file.filename)) + '.mp4';
  const outputPath = path.join(uploadDir, outputFilename);

  console.log(`Converting ${inputPath} -> ${outputPath}`);

  // Build ffmpeg args
  const args = [
    '-y', // overwrite
    '-i', inputPath,
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '23',
    '-c:a', 'aac',
    '-b:a', '128k',
    outputPath,
  ];

  try {
    const ffmpeg = spawn('ffmpeg', args, { stdio: 'inherit' });

    ffmpeg.on('error', (err) => {
      console.error('ffmpeg error:', err);
    });

    ffmpeg.on('close', (code) => {
      // Remove original upload
      try { fs.unlinkSync(inputPath); } catch (e) { /* ignore */ }

      if (code !== 0) {
        console.error(`ffmpeg exited with code ${code}`);
        return res.status(500).json({ success: false, message: 'Conversion failed' });
      }

      // Stream converted file back to client
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Disposition', `attachment; filename="${outputFilename}"`);

      const readStream = fs.createReadStream(outputPath);
      readStream.pipe(res);

      readStream.on('end', () => {
        // Cleanup converted file
        try { fs.unlinkSync(outputPath); } catch (e) { /* ignore */ }
      });

      readStream.on('error', (err) => {
        console.error('Read stream error:', err);
        try { fs.unlinkSync(outputPath); } catch (e) { /* ignore */ }
      });
    });
  } catch (err) {
    console.error('Conversion exception:', err);
    try { fs.unlinkSync(inputPath); } catch (e) { /* ignore */ }
    return res.status(500).json({ success: false, message: 'Conversion failed' });
  }
});

module.exports = router;
