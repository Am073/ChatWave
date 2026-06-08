const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User.model');
const ChatLog = require('../models/ChatLog.model');
const settings = require('../config/settings');
const { retrieveContext } = require('./retrieval.service');
const geminiProvider = require('../providers/gemini.provider');

const initWebSocket = (server) => {
  const wss = new WebSocket.Server({ noServer: true });

  // Handle upgrade manually
  server.on('upgrade', (request, socket, head) => {
    // If path is /ws, upgrade to WebSocket
    const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
    
    if (pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (ws) => {
    console.log('🔌 New WS connection established.');
    
    let authenticated = false;
    let user = null;

    ws.on('message', async (message) => {
      try {
        const payload = JSON.parse(message);

        // First message MUST be auth handshake (Fixes Bug #5)
        if (payload.type === 'auth') {
          const { token } = payload;
          if (!token) {
            ws.send(JSON.stringify({ type: 'error', error: 'Authentication token is required' }));
            ws.close(4001, 'Unauthorized');
            return;
          }

          try {
            const decoded = jwt.verify(token, settings.JWT_SECRET);
            const dbUser = await User.findById(decoded.userId);

            if (!dbUser || !dbUser.is_active) {
              ws.send(JSON.stringify({ type: 'error', error: 'Invalid user or account is inactive' }));
              ws.close(4002, 'Unauthorized');
              return;
            }

            user = dbUser;
            authenticated = true;
            ws.user = dbUser;
            ws.send(JSON.stringify({ type: 'auth_success', message: 'Authentication successful' }));
            console.log(`👤 WS User Authenticated: ${dbUser.name} (${dbUser.college_id})`);
          } catch (jwtError) {
            ws.send(JSON.stringify({ type: 'error', error: 'Invalid or expired auth token' }));
            ws.close(4003, 'Unauthorized');
          }
          return;
        }

        // Reject any non-auth message if not authenticated yet
        if (!authenticated) {
          ws.send(JSON.stringify({ type: 'error', error: 'Authentication required. Please send auth token first.' }));
          ws.close(4000, 'Unauthorized');
          return;
        }

        // Handle Chat Query
        if (payload.type === 'query' || payload.type === 'message') {
          const { question, sessionId, mode = 'college' } = payload;
          if (!question || !question.trim()) {
            ws.send(JSON.stringify({ type: 'error', error: 'Question content cannot be empty' }));
            return;
          }

          const finalSessionId = sessionId || uuidv4();
          console.log(`💬 WS Query [${mode}] from ${user.name}: "${question}"`);

          let contextChunks = [];
          let systemPrompt = '';
          let userPrompt = '';

          if (mode === 'general') {
            // ── General Mode: skip Qdrant, answer freely like a smart assistant ──
            systemPrompt = `You are ChatWave, a helpful AI assistant. Answer the user's question clearly, concisely, and accurately. You are not limited to any specific knowledge base — answer general knowledge, reasoning, and factual questions freely.`;
            userPrompt = `Question: ${question}\n\nAnswer:`;
            // No sources for general mode
            ws.send(JSON.stringify({ type: 'sources', sources: [] }));
          } else {
            // ── College Mode: retrieve context from Qdrant, answer RAG-style ──
            contextChunks = await retrieveContext(
              question,
              user.college_name,
              user.department,
              5
            );

            systemPrompt = `You are ChatWave, the official AI assistant for ${user.college_name}. Answer ONLY based on the provided context. If the answer is not in the context, say so honestly. Do not hallucinate.`;

            const contextText = contextChunks.length > 0
              ? contextChunks.map((chunk, i) =>
                  `[${i + 1}] Source: Document ${chunk.documentId}, Chunk ${chunk.chunkIndex}\nContent: ${chunk.text}\n`
                ).join('\n')
              : 'No relevant documents found in the college knowledge base.';

            userPrompt = `Context:\n${contextText}\n\nQuestion: ${question}\n\nAnswer:`;

            const sources = contextChunks.map(chunk => ({
              chunkIndex: chunk.chunkIndex,
              documentId: chunk.documentId,
              preview: chunk.text.length > 150 ? chunk.text.substring(0, 150) + '...' : chunk.text
            }));
            ws.send(JSON.stringify({ type: 'sources', sources }));
          }

          let fullAnswerText = '';

          // 4. Stream response via Gemini
          try {
            await geminiProvider.generateTextStream(userPrompt, systemPrompt, (chunkText) => {
              fullAnswerText += chunkText;
              ws.send(JSON.stringify({ type: 'chunk', text: chunkText }));
            });

            // 5. Save ChatLog — savedSources is empty array for general mode
            const savedSources = contextChunks.map(chunk => ({
              chunkIndex: chunk.chunkIndex,
              documentId: chunk.documentId,
              preview: chunk.text.length > 150 ? chunk.text.substring(0, 150) + '...' : chunk.text
            }));
            const chatLog = new ChatLog({
              user: user._id,
              college_name: user.college_name,
              question,
              answer: fullAnswerText,
              sources: savedSources,
              session_id: finalSessionId,
              tokens_used: 0
            });
            await chatLog.save();

            ws.send(JSON.stringify({
              type: 'done',
              sessionId: finalSessionId,
              chatLogId: chatLog._id
            }));
          } catch (streamError) {
            console.error('❌ Streaming error (full):', streamError);
            ws.send(JSON.stringify({
              type: 'chunk',
              text: '⚠️ Sorry, the AI service is temporarily unavailable. Please try again in a moment.'
            }));
            ws.send(JSON.stringify({
              type: 'done',
              sessionId: finalSessionId,
              chatLogId: null
            }));
          }
        }
      } catch (parseError) {
        console.error('WS message processing error:', parseError);
        ws.send(JSON.stringify({ type: 'error', error: 'Invalid payload format' }));
      }
    });

    ws.on('close', (code, reason) => {
      console.log(`🔌 WS Connection closed. Code: ${code}, Reason: ${reason}`);
    });
  });

  return wss;
};

module.exports = initWebSocket;
