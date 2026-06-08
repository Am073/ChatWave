const xlsx = require('xlsx');

const parseXlsx = async (buffer) => {
  try {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    let fullText = '';
    
    workbook.SheetNames.forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const csv = xlsx.utils.sheet_to_csv(sheet);
      if (csv && csv.trim()) {
        fullText += `Sheet: ${sheetName}\n${csv}\n\n`;
      }
    });
    
    return fullText.trim();
  } catch (error) {
    console.error('Error parsing XLSX buffer:', error);
    throw new Error(`Excel document parsing failed: ${error.message}`);
  }
};

module.exports = parseXlsx;
