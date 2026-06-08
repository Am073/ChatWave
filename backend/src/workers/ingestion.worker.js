const { parentPort, workerData } = require('worker_threads');
const mongoose = require('mongoose');
const settings = require('../config/settings');
const { ingestDocument } = require('../services/ingestion.service');

const run = async () => {
  try {
    const { documentId, buffer, mimeType, collegeName, department, mongoUri } = workerData;
    const dbUri = mongoUri || settings.MONGO_URI;

    // Connect to database in worker thread
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(dbUri);
    }

    // Ensure buffer is converted back to a Buffer object
    const fileBuffer = Buffer.from(buffer);

    await ingestDocument(documentId, fileBuffer, mimeType, collegeName, department);

    parentPort.postMessage({ success: true, documentId });
  } catch (error) {
    console.error('Worker thread execution error:', error);
    parentPort.postMessage({
      error: error.message || 'Worker thread failed',
      documentId: workerData?.documentId
    });
  } finally {
    // Thread exits naturally after this function returns.
  }
};

run();
