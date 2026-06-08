process.env.NODE_ENV = 'test';

const http = require('http');
const mongoose = require('mongoose');
const app = require('../app');
const connectToDatabase = require('../src/config/database');
const initWebSocket = require('../src/services/websocket.service');

const PORT = 5001;
const BASE_URL = `http://localhost:${PORT}/api`;

let server = null;

const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer = null;

const startTestServer = async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  // Dynamically override DB connection URI in settings
  const settings = require('../src/config/settings');
  settings.MONGO_URI = mongoUri;
  process.env.MONGO_URI = mongoUri;

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(mongoUri);
  }
  
  // Clear collections for clean test run
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }

  server = http.createServer(app);
  initWebSocket(server);

  await new Promise((resolve, reject) => {
    server.listen(PORT, resolve);
    server.once('error', (err) => {
      console.error(`[Test Server] Failed to listen on port ${PORT}:`, err.message);
      reject(err);
    });
  });
};

const stopTestServer = async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
};

class TestClient {
  constructor() {
    this.cookiesMap = {};
    this.cookies = '';
    this.csrfToken = '';
  }

  async request(path, options = {}) {
    const url = `${BASE_URL}${path}`;
    const headers = { ...options.headers };

    if (this.cookies) {
      headers['Cookie'] = this.cookies;
    }
    if (this.csrfToken) {
      headers['X-CSRF-Token'] = this.csrfToken;
    }

    const isFormData = options.body && options.body.constructor && options.body.constructor.name === 'FormData';
    if (options.body && typeof options.body === 'object' && !(options.body instanceof Uint8Array) && !isFormData) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const setCookies = response.headers.getSetCookie ? response.headers.getSetCookie() : (response.headers.get('set-cookie') ? [response.headers.get('set-cookie')] : []);
    if (setCookies.length > 0) {
      for (const cookieStr of setCookies) {
        const firstPart = cookieStr.split(';')[0].trim();
        const eqIdx = firstPart.indexOf('=');
        if (eqIdx !== -1) {
          const name = firstPart.substring(0, eqIdx).trim();
          const value = firstPart.substring(eqIdx + 1).trim();
          this.cookiesMap[name] = value;
          if (name === 'csrf_token') {
            this.csrfToken = value;
          }
        }
      }
      this.cookies = Object.entries(this.cookiesMap)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
    }

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    return {
      status: response.status,
      data,
      headers: response.headers,
    };
  }

  async get(path) {
    return this.request(path, { method: 'GET' });
  }

  async post(path, body, headers = {}) {
    return this.request(path, { method: 'POST', body, headers });
  }

  async put(path, body) {
    return this.request(path, { method: 'PUT', body });
  }

  async delete(path) {
    return this.request(path, { method: 'DELETE' });
  }
}

module.exports = {
  startTestServer,
  stopTestServer,
  TestClient,
  PORT,
};
