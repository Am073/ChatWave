const geminiProvider = require('../providers/gemini.provider');

/**
 * Generate response using Gemini provider based on context chunks.
 * 
 * @param {string} question - The user's query.
 * @param {Array<{text: string, documentId: string, chunkIndex: number}>} contextChunks - Retrieved document chunks.
 * @param {string} userRole - Role of the requesting user.
 * @param {string} collegeName - College scope.
 * @returns {Promise<{answer: string, sources: Array<{chunkIndex: number, documentId: string, preview: string}>}>}
 */
const generateResponse = async (question, contextChunks, userRole, collegeName) => {
  try {
    // a. Build system prompt
    const systemPrompt = `You are ChatWave, the official AI assistant for ${collegeName}. Answer ONLY based on the provided context. If the answer is not in the context, say so. Do not hallucinate.`;

    // b. Build user prompt with context chunks numbered [1], [2], etc.
    let contextText = '';
    if (contextChunks && contextChunks.length > 0) {
      contextText = contextChunks.map((chunk, i) => {
        return `[${i + 1}] Source: Document ${chunk.documentId || 'Unknown'}, Chunk ${chunk.chunkIndex ?? 0}\nContent: ${chunk.text}\n`;
      }).join('\n');
    } else {
      contextText = 'No context provided.';
    }

    const userPrompt = `Context:\n${contextText}\n\nQuestion: ${question}\n\nAnswer:`;

    // c. Call Gemini provider
    const answer = await geminiProvider.generateText(userPrompt, systemPrompt);

    // d. Format sources
    const sources = (contextChunks || []).map(chunk => ({
      chunkIndex: chunk.chunkIndex,
      documentId: chunk.documentId,
      preview: chunk.text.length > 150 ? chunk.text.substring(0, 150) + '...' : chunk.text
    }));

    return {
      answer: answer || 'Could not generate response.',
      sources
    };
  } catch (error) {
    console.error('Error generating AI response:', error);
    return {
      answer: 'Sorry, I encountered an error while processing your request.',
      sources: []
    };
  }
};

module.exports = {
  generateResponse
};
