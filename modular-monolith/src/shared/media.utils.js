import QRCode from 'qrcode';
import sharp from 'sharp';

/**
 * generateBrandedQR
 * 
 * Generates a high-quality QR code buffer, optionally compositing a logo 
 * at a specific position.
 */
export async function generateBrandedQR(text, logoPath = null, position = 'center') {
  try {
    const qrBuffer = await QRCode.toBuffer(text, { 
      errorCorrectionLevel: 'H', 
      margin: 1, 
      width: 600, 
      color: { dark: '#000000', light: '#ffffff' } 
    });

    if (!logoPath) {
      return `data:image/png;base64,${qrBuffer.toString('base64')}`;
    }

    const qrMetadata = await sharp(qrBuffer).metadata();
    const logoSize = Math.floor(qrMetadata.width * 0.18);
    const maskSize = Math.floor(logoSize * 1.15);

    // Create a white mask for the logo background
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
    console.error('[MediaUtils] QR Generation Error:', error.message);
    return null;
  }
}
