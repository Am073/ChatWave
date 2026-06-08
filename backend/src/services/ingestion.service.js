const { v4: uuidv4 } = require('uuid');
const parsePdf = require('../utils/pdfParser');
const parseDocx = require('../utils/docxParser');
const parseXlsx = require('../utils/xlsxParser');
const parseImage = require('../utils/imageParser');
const { chunkText } = require('../utils/chunker');
const geminiProvider = require('../providers/gemini.provider');
const qdrantProvider = require('../providers/qdrant.provider');
const Document = require('../models/Document.model');

const parseFile = async (buffer, mimeType) => {
  switch (mimeType) {
    case 'application/pdf':
      return await parsePdf(buffer);
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return await parseDocx(buffer);
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return await parseXlsx(buffer);
    case 'image/png':
    case 'image/jpeg':
    case 'image/webp':
      return await parseImage(buffer);
    default:
      throw new Error(`Unsupported MIME type: ${mimeType}`);
  }
};

const ingestDocument = async (documentId, buffer, mimeType, collegeName, department) => {
  try {
    // a. Update status to processing
    await Document.findByIdAndUpdate(documentId, { status: 'processing' });

    // b. Parse file to text
    const text = await parseFile(buffer, mimeType);
    if (!text || !text.trim()) {
      throw new Error('No text content could be extracted from the file');
    }

    // c. Chunk text
    const chunks = chunkText(text, 500, 100);
    if (chunks.length === 0) {
      throw new Error('No valid text chunks generated');
    }

    const points = [];
    const qdrantIds = [];

    // d. Generate embeddings and construct Qdrant points
    for (const chunk of chunks) {
      const embedding = await geminiProvider.generateEmbedding(chunk.text);
      const pointId = uuidv4();
      
      points.push({
        id: pointId,
        vector: embedding,
        payload: {
          documentId: documentId.toString(),
          chunkIndex: chunk.index,
          text: chunk.text,
          collegeName,
          department: department || 'college_wide',
        },
      });
      qdrantIds.push(pointId);
    }

    // e. Upsert vectors to Qdrant
    await qdrantProvider.upsertVectors(collegeName, points);

    // f. Update Document model status to completed
    await Document.findByIdAndUpdate(documentId, {
      status: 'completed',
      chunk_count: chunks.length,
      qdrant_ids: qdrantIds,
      error_message: null,
    });

    console.log(`Document ${documentId} ingestion completed successfully. Chunks: ${chunks.length}`);
    return { success: true, documentId };
  } catch (error) {
    console.error(`Ingestion failed for document ${documentId}:`, error);
    
    // On any error: update Document status to failed with error_message
    await Document.findByIdAndUpdate(documentId, {
      status: 'failed',
      error_message: error.message || 'Unknown ingestion error',
    });
    
    throw error;
  }
};

module.exports = {
  parseFile,
  ingestDocument,
};
