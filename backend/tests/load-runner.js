process.env.NODE_ENV = 'test';

const http = require('http');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const bcrypt = require('bcryptjs');
bcrypt.compare = async () => true;
bcrypt.hash = async (data) => `hashed_${data}`;

const autocannon = require('autocannon');
const WebSocket = require('ws');

const app = require('../app');
const initWebSocket = require('../src/services/websocket.service');
const settings = require('../src/config/settings');
const User = require('../src/models/User.model');
const Document = require('../src/models/Document.model');
const Announcement = require('../src/models/Announcement.model');

const PORT = 5002;
const BASE_URL = `http://localhost:${PORT}/api`;
const WS_URL = `ws://localhost:${PORT}/ws`;

let server;
let mongoServer;
let userId;
let rawAccessToken;
let csrfToken;
let csrfCookies;
let cookieHeader;
let loggedInCsrfToken;

// Mock Gemini & Qdrant for RAG chat load test speed & stability
const geminiProvider = require('../src/providers/gemini.provider');
const qdrantProvider = require('../src/providers/qdrant.provider');
geminiProvider.generateEmbedding = async () => new Array(768).fill(0.1);
geminiProvider.generateText = async () => 'Mock load test answer.';
geminiProvider.generateTextStream = async (prompt, systemPrompt, onChunk) => {
  onChunk('Mock ');
  onChunk('load ');
  onChunk('test ');
  onChunk('stream.');
  return 'Mock load test stream.';
};
qdrantProvider.search = async () => [
  {
    score: 0.95,
    payload: {
      text: 'Mock section for load test.',
      documentId: '6a213ba475aa827916fec999',
      chunkIndex: 1
    }
  }
];

function extractCookies(res) {
  const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : []);
  const cookies = {};
  for (const cookieStr of setCookies) {
    const firstPart = cookieStr.split(';')[0].trim();
    const eqIdx = firstPart.indexOf('=');
    if (eqIdx !== -1) {
      const name = firstPart.substring(0, eqIdx).trim();
      const value = firstPart.substring(eqIdx + 1).trim();
      cookies[name] = value;
    }
  }
  return cookies;
}

async function setup() {
  console.log('--- Setting up Load Test Server ---');
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  settings.MONGO_URI = mongoUri;
  process.env.MONGO_URI = mongoUri;

  await mongoose.connect(mongoUri);

  // Seed user
  const hashedPassword = await bcrypt.hash('Password@123', 12);
  const user = new User({
    name: 'Load Test Student',
    college_id: 'STUDENT_LOAD_TEST',
    password: hashedPassword,
    college_name: 'Test College',
    department: 'Computer Science',
    role: 'student',
    username: 'STUDENT_LOAD_TEST',
    email: 'student_load_test@chatwave.edu',
    is_active: true,
  });
  await user.save();
  userId = user._id;

  // Seed document
  const doc = new Document({
    _id: new mongoose.Types.ObjectId("6a213ba475aa827916fec999"),
    uploader: userId,
    college_name: 'Test College',
    department: null,
    filename: 'syllabus.pdf',
    file_type: 'application/pdf',
    status: 'completed',
    chunk_count: 5,
  });
  await doc.save();

  // Seed announcement
  const announcement = new Announcement({
    author: userId,
    college_name: 'Test College',
    department: null,
    title: 'Load Test Announcement',
    content: 'This is a load test announcement.',
    is_private: false,
  });
  await announcement.save();

  // Start HTTP and WebSocket server
  server = http.createServer(app);
  initWebSocket(server);

  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`Server listening on port ${PORT}\n`);

  // Obtain authentication tokens & cookies
  const csrfRes = await fetch(`${BASE_URL}/auth/csrf-token`);
  const csrfData = await csrfRes.json();
  csrfToken = csrfData.csrfToken;
  rawAccessToken = csrfData.accessToken || '';
  csrfCookies = extractCookies(csrfRes);

  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-csrf-token': csrfToken,
      'cookie': `csrf_token=${csrfCookies.csrf_token}`,
    },
    body: JSON.stringify({
      college_id: 'STUDENT_LOAD_TEST',
      password: 'Password@123',
      role: 'student',
    }),
  });

  const loginCookies = extractCookies(loginRes);
  const loginData = await loginRes.json();
  
  // Merge cookies
  const allCookies = { ...csrfCookies, ...loginCookies };
  cookieHeader = Object.entries(allCookies).map(([k, v]) => `${k}=${v}`).join('; ');
  loggedInCsrfToken = allCookies.csrf_token;

  // Fetch CSRF token again with logged in session to acquire raw access token
  const authenticatedCsrfRes = await fetch(`${BASE_URL}/auth/csrf-token`, {
    headers: {
      'cookie': cookieHeader
    }
  });
  const authenticatedCsrfData = await authenticatedCsrfRes.json();
  rawAccessToken = authenticatedCsrfData.accessToken;
}

function printAutocannonResults(result) {
  console.log(`Results:`);
  console.log(`- Connections:      ${result.connections}`);
  console.log(`- Duration:         ${result.duration}s`);
  console.log(`- Req/sec (avg):    ${result.requests.average}`);
  console.log(`- Req/sec (max):    ${result.requests.max}`);
  console.log(`- Latency (avg):    ${result.latency.average} ms`);
  console.log(`- Latency (p50):    ${result.latency.p50} ms`);
  console.log(`- Latency (p90):    ${result.latency.p90} ms`);
  console.log(`- Latency (p99):    ${result.latency.p99} ms`);
  console.log(`- Total Requests:   ${result.requests.sent}`);
  console.log(`- Total Errors:     ${result.errors}`);
  console.log(`- Non-2xx Resp:     ${result.non2xx}`);
}

async function runAutocannonScenario(name, options) {
  console.log(`\n=========================================\nRunning Load Test: ${name}\n=========================================`);
  return new Promise((resolve, reject) => {
    const instance = autocannon(options, (err, result) => {
      if (err) return reject(err);
      printAutocannonResults(result);
      resolve(result);
    });
    autocannon.track(instance, { renderResultsTable: false });
  });
}

async function runWsLoadTest(concurrency = 50) {
  console.log(`\n=========================================\nRunning Load Test: WebSocket Connections (${concurrency} clients)\n=========================================`);
  
  const startTime = Date.now();
  let attempted = 0;
  let succeeded = 0;
  let failed = 0;
  const durations = [];

  const promises = Array.from({ length: concurrency }).map((_, index) => {
    return new Promise((resolve) => {
      attempted++;
      const clientStart = Date.now();
      const ws = new WebSocket(WS_URL);

      ws.on('open', () => {
        // Send handshake
        ws.send(JSON.stringify({ type: 'auth', token: rawAccessToken }));
      });

      ws.on('message', (dataStr) => {
        const msg = JSON.parse(dataStr);
        if (msg.type === 'auth_success') {
          // Send query
          ws.send(JSON.stringify({ type: 'query', question: 'What is the schedule?', sessionId: `load-ws-${index}` }));
        } else if (msg.type === 'done') {
          ws.close();
        }
      });

      ws.on('close', () => {
        succeeded++;
        durations.push(Date.now() - clientStart);
        resolve();
      });

      ws.on('error', (err) => {
        failed++;
        resolve();
      });
    });
  });

  await Promise.all(promises);

  const totalTime = Date.now() - startTime;
  const avgDuration = durations.reduce((a, b) => a + b, 0) / (durations.length || 1);
  const minDuration = Math.min(...durations);
  const maxDuration = Math.max(...durations);

  console.log(`WebSocket Load Test Results:`);
  console.log(`- Attempted Connections: ${attempted}`);
  console.log(`- Successful Runs:      ${succeeded}`);
  console.log(`- Failed Runs:          ${failed}`);
  console.log(`- Success Rate:         ${((succeeded / attempted) * 100).toFixed(2)}%`);
  console.log(`- Avg Round-Trip Time:  ${avgDuration.toFixed(2)} ms`);
  console.log(`- Min Round-Trip Time:  ${minDuration} ms`);
  console.log(`- Max Round-Trip Time:  ${maxDuration} ms`);
  console.log(`- Total Execution Time: ${totalTime} ms`);
}

async function shutdown() {
  console.log('\n--- Shutting down Load Test Server ---');
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await mongoose.connection.close();
  if (mongoServer) {
    await mongoServer.stop();
  }
  console.log('Server shut down successfully.');
}

async function main() {
  try {
    await setup();

    // Scenario 1: Login Route Load Test
    await runAutocannonScenario('POST /api/auth/login', {
      url: `${BASE_URL}/auth/login`,
      method: 'POST',
      connections: 50,
      duration: 5,
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': csrfToken,
        'cookie': `csrf_token=${csrfCookies.csrf_token}`
      },
      body: JSON.stringify({
        college_id: 'STUDENT_LOAD_TEST',
        password: 'Password@123',
        role: 'student'
      })
    });

    // Scenario 2: Announcements Route Load Test
    await runAutocannonScenario('GET /api/announcements', {
      url: `${BASE_URL}/announcements`,
      method: 'GET',
      connections: 50,
      duration: 5,
      headers: {
        'cookie': cookieHeader
      }
    });

    // Scenario 3: Chat Route Load Test
    await runAutocannonScenario('POST /api/chat', {
      url: `${BASE_URL}/chat`,
      method: 'POST',
      connections: 50,
      duration: 5,
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': loggedInCsrfToken,
        'cookie': cookieHeader
      },
      body: JSON.stringify({
        question: 'What is the exam schedule?',
        sessionId: 'session-load-test'
      })
    });

    // Scenario 4: Document Status Polling Load Test
    await runAutocannonScenario('GET /api/upload/status/:id', {
      url: `${BASE_URL}/upload/status/6a213ba475aa827916fec999`,
      method: 'GET',
      connections: 50,
      duration: 5,
      headers: {
        'cookie': cookieHeader
      }
    });

    // Scenario 5: WebSocket Connections Load Test
    await runWsLoadTest(100);

  } catch (error) {
    console.error('Error during load test execution:', error);
  } finally {
    await shutdown();
  }
}

main();
