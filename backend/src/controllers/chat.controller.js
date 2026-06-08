const { v4: uuidv4 } = require('uuid');
const ChatLog = require('../models/ChatLog.model');
const { retrieveContext } = require('../services/retrieval.service');
const { generateResponse } = require('../services/ai.service');

exports.sendMessage = async (req, res) => {
  try {
    const { question, sessionId } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const finalSessionId = sessionId || uuidv4();

    // 1. Retrieve relevant context
    const contextChunks = await retrieveContext(
      question,
      req.user.college_name,
      req.user.department,
      5
    );

    // 2. Generate response via Gemini LLM
    const { answer, sources } = await generateResponse(
      question,
      contextChunks,
      req.user.role,
      req.user.college_name
    );

    // 3. Save ChatLog in MongoDB (Fixes Bug #2: uses MongoDB ObjectId ref/ID automatically)
    const chatLog = new ChatLog({
      user: req.user._id,
      college_name: req.user.college_name,
      question,
      answer,
      sources,
      session_id: finalSessionId,
      tokens_used: 0 // Mock value
    });

    await chatLog.save();

    return res.status(200).json({
      id: chatLog._id,
      answer,
      sources,
      sessionId: finalSessionId,
    });
  } catch (error) {
    console.error('REST Chat error:', error);
    return res.status(500).json({ error: 'Internal server error during chat' });
  }
};

exports.getHistory = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const { sessionId } = req.query;

    const query = {
      user: req.user._id,
      college_name: req.user.college_name,
    };

    if (sessionId) {
      query.session_id = sessionId;
    }

    const total = await ChatLog.countDocuments(query);
    const logs = await ChatLog.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const mappedLogs = logs.map(log => {
      const obj = log.toObject();
      obj.id = log._id.toString();
      obj.created_at = log.createdAt;
      // Convert sources array to a JSON string if needed, but wait! The frontend does:
      // log.source_reference ? JSON.parse(log.source_reference) : []
      // Let's also serialize sources into source_reference for compatibility!
      obj.source_reference = JSON.stringify(log.sources || []);
      return obj;
    });

    return res.status(200).json({
      total,
      page,
      limit,
      history: mappedLogs,
      logs: mappedLogs,
    });
  } catch (error) {
    console.error('Get chat history error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

exports.clearHistory = async (req, res) => {
  try {
    await ChatLog.deleteMany({
      user: req.user._id,
      college_name: req.user.college_name,
    });

    return res.status(200).json({ message: 'Chat history cleared successfully' });
  } catch (error) {
    console.error('Clear chat history error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
