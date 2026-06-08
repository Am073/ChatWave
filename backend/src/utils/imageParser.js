const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const tesseract = require('node-tesseract-ocr');

const parseImage = async (buffer) => {
  const tempDir = os.tmpdir();
  const tempFileName = `ocr_${uuidv4()}.png`;
  const tempFilePath = path.join(tempDir, tempFileName);

  try {
    // Write buffer to temporary file
    await fs.writeFile(tempFilePath, buffer);

    const config = {
      lang: 'eng',
      oem: 1,
      psm: 3,
    };

    // Recognize text
    const text = await tesseract.recognize(tempFilePath, config);
    return text || '';
  } catch (error) {
    console.error('Error in image OCR parsing:', error);
    // If tesseract binary is not installed, return a warning or throw
    // For tests/dev environment, if it fails because of missing binary, we should handle it gracefully
    // by falling back or throwing a descriptive error
    throw new Error(`Image parsing failed: ${error.message}`);
  } finally {
    // Clean up temporary file
    try {
      await fs.unlink(tempFilePath);
    } catch (cleanupError) {
      // Ignore if file didn't exist or already removed
    }
  }
};

module.exports = parseImage;
