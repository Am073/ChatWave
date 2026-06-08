const { Worker } = require('worker_threads');
const path = require('path');
const Document = require('../models/Document.model');
const qdrantProvider = require('../providers/qdrant.provider');
const settings = require('../config/settings');

exports.uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const scope = req.body.scope || 'college_wide';
    const department = scope === 'department' ? req.user.department : null;

    // Create Document record
    const doc = new Document({
      uploader: req.user._id,
      college_name: req.user.college_name,
      department,
      filename: req.file.originalname,
      file_type: req.file.mimetype,
      status: 'pending',
    });

    await doc.save();

    // Spawn worker thread for background ingestion (Fixes Bug #9)
    const workerPath = path.join(__dirname, '../workers/ingestion.worker.js');
    const worker = new Worker(workerPath, {
      workerData: {
        documentId: doc._id.toString(),
        buffer: req.file.buffer, // Safe to pass in-memory buffer
        mimeType: req.file.mimetype,
        collegeName: req.user.college_name,
        department,
        mongoUri: settings.MONGO_URI, // Explicitly pass current database connection URI
      },
    });

    worker.on('message', (msg) => {
      console.log(`[Worker Message] Ingestion worker finished:`, msg);
    });

    worker.on('error', (err) => {
      console.error(`[Worker Error] Ingestion worker failed:`, err);
    });

    worker.on('exit', (code) => {
      console.log(`[Worker Exit] Ingestion worker exited with code: ${code}`);
    });

    // Return immediately (202 Accepted)
    return res.status(202).json({
      message: 'File uploaded and processing started in background',
      documentId: doc._id,
    });
  } catch (error) {
    console.error('Upload document controller error:', error);
    return res.status(500).json({ error: 'Internal server error during upload' });
  }
};

exports.getDocumentStatus = async (req, res) => {
  try {
    const { documentId } = req.params;
    const doc = await Document.findById(documentId);

    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Multi-tenant check
    if (doc.college_name !== req.user.college_name) {
      return res.status(403).json({ error: 'Access denied: document belongs to another college' });
    }

    return res.status(200).json({
      documentId: doc._id,
      filename: doc.filename,
      status: doc.status,
      chunk_count: doc.chunk_count,
      error_message: doc.error_message,
    });
  } catch (error) {
    console.error('Get document status error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

exports.listDocuments = async (req, res) => {
  try {
    const query = { college_name: req.user.college_name };

    // Strict scope checking: Non-admins can only see college-wide or their own department's documents
    if (req.user.role !== 'admin') {
      query.$or = [
        { department: null },
        { department: req.user.department },
      ];
    }

    const docs = await Document.find(query)
      .populate('uploader', 'name role')
      .sort({ createdAt: -1 });

    return res.status(200).json(docs);
  } catch (error) {
    console.error('List documents error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

exports.deleteDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    const doc = await Document.findById(documentId);

    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Multi-tenant check
    if (doc.college_name !== req.user.college_name) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Role check: Admin can delete any, Faculty can delete only their own uploaded docs
    if (req.user.role !== 'admin' && doc.uploader.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied: you can only delete your own documents' });
    }

    // Remove vectors from Qdrant Cloud
    try {
      await qdrantProvider.deleteByDocumentId(doc.college_name, doc._id.toString());
    } catch (qdrantError) {
      console.error(`Failed to remove vectors for document ${documentId} from Qdrant:`, qdrantError.message);
      // Continue deleting Document record even if Qdrant call fails (e.g. key expired / connection down)
    }

    // Delete record from DB
    await Document.findByIdAndDelete(documentId);

    return res.status(200).json({ message: 'Document and associated vectors deleted successfully' });
  } catch (error) {
    console.error('Delete document error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
