const test = require('node:test');
const assert = require('node:assert');
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const { startTestServer, stopTestServer, TestClient, PORT } = require('./helper');
const geminiProvider = require('../src/providers/gemini.provider');
const qdrantProvider = require('../src/providers/qdrant.provider');
const ChatLog = require('../src/models/ChatLog.model');
const settings = require('../src/config/settings');

// Mock external APIs for reliable testing
geminiProvider.generateEmbedding = async () => new Array(768).fill(0.1);
geminiProvider.generateText = async () => 'Mock answer from ChatWave.';
geminiProvider.generateTextStream = async (prompt, systemPrompt, onChunk) => {
  onChunk('Mock ');
  onChunk('streamed ');
  onChunk('response.');
  return 'Mock streamed response.';
};
qdrantProvider.search = async () => [
  {
    score: 0.95,
    payload: {
      text: 'Mock document section content.',
      documentId: 'doc123',
      chunkIndex: 2
    }
  }
];

test.describe('Chat API & WebSocket RAG Tests', () => {
  let studentClient;
  let rawAccessToken;
  let userId;

  test.before(async () => {
    await startTestServer();

    studentClient = new TestClient();
    const csrfRes = await studentClient.get('/auth/csrf-token');
    
    const regRes = await studentClient.post('/auth/register', {
      name: 'Student Chat Tester',
      college_id: 'STUDENT_CHAT_01',
      password: 'Password@123',
      college_name: 'Test College',
      department: 'Computer Science',
      role: 'student',
    });

    userId = regRes.data.user.id;

    // Fetch CSRF token again to get the actual accessToken returned in json
    const tokenRes = await studentClient.get('/auth/csrf-token');
    rawAccessToken = tokenRes.data.accessToken;
  });

  test.after(async () => {
    await stopTestServer();
  });

  test('1. POST /api/chat with a question → expect { answer, sources }', async () => {
    const res = await studentClient.post('/chat', {
      question: 'What is the exam schedule?',
      sessionId: 'session-123',
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.answer, 'Mock answer from ChatWave.');
    assert.ok(res.data.sources);
    assert.strictEqual(res.data.sources.length, 1);
    assert.strictEqual(res.data.sources[0].documentId, 'doc123');
  });

  test('2. Verify ChatLog saved in MongoDB', async () => {
    const log = await ChatLog.findOne({ user: userId });
    assert.ok(log);
    assert.strictEqual(log.question, 'What is the exam schedule?');
    assert.strictEqual(log.answer, 'Mock answer from ChatWave.');
    assert.strictEqual(log.session_id, 'session-123');
  });

  test('3. Test WebSocket auth handshake — connect without auth message → expect connection closed', async () => {
    const ws = new WebSocket(`ws://localhost:${PORT}/ws`);
    
    const promise = new Promise((resolve) => {
      ws.on('open', () => {
        // Send a query query before authenticating
        ws.send(JSON.stringify({ type: 'query', question: 'hello' }));
      });
      
      ws.on('close', (code, reason) => {
        // Expect closed code 4000 or similar
        assert.ok(code >= 4000);
        resolve();
      });
    });

    await promise;
  });

  test('4. Test WebSocket with valid token → expect streaming response', async () => {
    const ws = new WebSocket(`ws://localhost:${PORT}/ws`);
    
    const promise = new Promise((resolve, reject) => {
      let authed = false;
      let chunksReceived = '';
      let sourcesReceived = null;
      let isDone = false;

      ws.on('open', () => {
        // Send first message auth handshake
        ws.send(JSON.stringify({ type: 'auth', token: rawAccessToken }));
      });

      ws.on('message', (message) => {
        const data = JSON.parse(message);
        
        if (data.type === 'auth_success') {
          authed = true;
          // Send subsequent query
          ws.send(JSON.stringify({ type: 'query', question: 'Tell me about exams', sessionId: 'ws-session-456' }));
        } else if (data.type === 'chunk') {
          chunksReceived += data.text;
        } else if (data.type === 'sources') {
          sourcesReceived = data.sources;
        } else if (data.type === 'done') {
          isDone = true;
          ws.close();
        } else if (data.type === 'error') {
          reject(new Error(data.error));
        }
      });

      ws.on('close', () => {
        assert.ok(authed);
        assert.strictEqual(chunksReceived, 'Mock streamed response.');
        assert.ok(sourcesReceived);
        assert.strictEqual(sourcesReceived[0].documentId, 'doc123');
        assert.ok(isDone);
        resolve();
      });
    });

    await promise;
  });
});
