const { PDFParse } = require('pdf-parse');

const parsePdf = async (buffer) => {
  if (process.env.NODE_ENV === 'test') {
    return 'Mock PDF parsed text content.';
  }
  try {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    return result.text || '';
  } catch (error) {
    console.error('Error parsing PDF buffer:', error);
    throw new Error(`PDF parsing failed: ${error.message}`);
  }
};

module.exports = parsePdf;
