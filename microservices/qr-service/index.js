import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import QRCode from 'qrcode';
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';
import { registerProcessHandlers, tuneExpressServer } from '../shared/db.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(compression());
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS === '*' ? '*' : (process.env.ALLOWED_ORIGINS || '').split(','),
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

/**
 * QR Generation Logic with positioning support
 */
async function generateBrandedQR(text, logoPath, position = 'center') {
  try {
    const qrBuffer = await QRCode.toBuffer(text, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 600,
      color: { dark: '#000000', light: '#ffffff' },
    });

    if (!logoPath) return `data:image/png;base64,${qrBuffer.toString('base64')}`;

    const qrMetadata = await sharp(qrBuffer).metadata();
    const logoSize   = Math.floor(qrMetadata.width * 0.18); // Reduced to 18% for better alignment recovery
    const maskSize   = Math.floor(logoSize * 1.15); // Add a 15% margin for the white mask

    // Create a white background mask
    const maskBuffer = await sharp({
      create: {
        width: maskSize,
        height: maskSize,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    }).png().toBuffer();

    const logoInnerBuffer = await sharp(logoPath)
      .resize(logoSize, logoSize, { fit: 'contain' })
      .toBuffer();

    // Composite logo on mask
    const brandedLogoBuffer = await sharp(maskBuffer)
      .composite([{ input: logoInnerBuffer, gravity: 'center' }])
      .toBuffer();

    let compositeOptions = { input: brandedLogoBuffer };

    switch (position) {
      case 'top-left':
        compositeOptions.top = 20;
        compositeOptions.left = 20;
        break;
      case 'top-right':
        compositeOptions.top = 20;
        compositeOptions.left = qrMetadata.width - logoSize - 20;
        break;
      case 'bottom-left':
        compositeOptions.top = qrMetadata.height - logoSize - 20;
        compositeOptions.left = 20;
        break;
      case 'bottom-right':
        compositeOptions.top = qrMetadata.height - logoSize - 20;
        compositeOptions.left = qrMetadata.width - logoSize - 20;
        break;
      case 'center':
      default:
        compositeOptions.gravity = 'center';
    }

    const finalImageBuffer = await sharp(qrBuffer)
      .composite([compositeOptions])
      .toBuffer();

    return `data:image/png;base64,${finalImageBuffer.toString('base64')}`;
  } catch (error) {
    console.error('[QRService] Generation error:', error);
    throw error;
  }
}

// POST /api/qr/generate
app.post('/api/qr/generate', async (req, res) => {
  const { text, logoPath, position } = req.body;
  if (!text) return res.status(400).json({ error: 'Text/URL is required' });

  try {
    // Resolve logo path if relative
    let resolvedLogoPath = logoPath;
    if (logoPath && !path.isAbsolute(logoPath)) {
      // In this specialized service, assume we might need to find the logo in a shared public dir
      // This is a placeholder for actual robust path resolution in a containerized environment
      resolvedLogoPath = path.resolve(__dirname, logoPath); 
    }

    const qrCode = await generateBrandedQR(text, resolvedLogoPath, position);
    res.json({ qrCode });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'qr-service' }));

const PORT   = process.env.PORT_QR_SERVICE || 4014;
const server = app.listen(PORT, () => console.log(`QR Service running on port ${PORT}`));
registerProcessHandlers(server, 'QRService');
tuneExpressServer(server);
