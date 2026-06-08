const geminiProvider = require('../providers/gemini.provider');
const qdrantProvider = require('../providers/qdrant.provider');

/**
 * Retrieve relevant chunks from Qdrant for a given query.
 * 
 * @param {string} query - The user's search query.
 * @param {string} collegeName - College scope.
 * @param {string} department - User's department.
 * @param {number} topK - Max results to return.
 * @returns {Promise<Array<{text: string, score: number, documentId: string, chunkIndex: number}>>}
 */
const retrieveContext = async (query, collegeName, department, topK = 5) => {
  try {
    // a. Generate query embedding via geminiProvider
    const queryEmbedding = await geminiProvider.generateEmbedding(query);

    // b. Construct filter based on department
    // Allow either college-wide documents or department-specific documents
    let filter = null;
    if (department && department !== 'college_wide') {
      filter = {
        should: [
          {
            key: 'department',
            match: {
              value: 'college_wide'
            }
          },
          {
            key: 'department',
            match: {
              value: department
            }
          }
        ]
      };
    }

    // c. Search Qdrant collection
    const searchResults = await qdrantProvider.search(collegeName, queryEmbedding, topK, filter);

    // d. Map results to returned structure
    return searchResults.map(match => ({
      text: match.payload?.text || '',
      score: match.score || 0,
      documentId: match.payload?.documentId || null,
      chunkIndex: match.payload?.chunkIndex ?? null
    }));
  } catch (error) {
    console.error('Error retrieving context from Qdrant:', error);
    // Return empty context on error rather than crashing
    return [];
  }
};

module.exports = {
  retrieveContext
};
