const mammoth = require('mammoth');

const parseDocx = async (buffer) => {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  } catch (error) {
    console.error('Error parsing DOCX buffer:', error);
    throw new Error(`Word document parsing failed: ${error.message}`);
  }
};

module.exports = parseDocx;
