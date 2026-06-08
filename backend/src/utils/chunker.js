/**
 * Sliding window chunking on word boundaries.
 * 
 * @param {string} text - The input text to chunk.
 * @param {number} chunkSize - Number of words per chunk.
 * @param {number} overlap - Number of overlapping words between consecutive chunks.
 * @returns {Array<{text: string, index: number}>}
 */
const chunkText = (text, chunkSize = 500, overlap = 100) => {
  if (!text || !text.trim()) {
    return [];
  }

  const words = text.trim().split(/\s+/);
  if (words.length === 0) {
    return [];
  }

  const chunks = [];
  let index = 0;
  const step = Math.max(1, chunkSize - overlap);

  for (let i = 0; i < words.length; i += step) {
    const chunkWords = words.slice(i, i + chunkSize);
    const chunkContent = chunkWords.join(' ');
    
    if (chunkContent.trim().length > 0) {
      chunks.push({
        text: chunkContent,
        index: index++
      });
    }

    // Stop if we have reached the end of the text
    if (i + chunkSize >= words.length) {
      break;
    }
  }

  return chunks;
};

module.exports = {
  chunkText
};
