const test = require('node:test');
const assert = require('node:assert');
const { startTestServer, stopTestServer, TestClient } = require('./helper');
const geminiProvider = require('../src/providers/gemini.provider');
const qdrantProvider = require('../src/providers/qdrant.provider');

// Mock external APIs for reliable testing
geminiProvider.generateEmbedding = async () => new Array(768).fill(0.1);
qdrantProvider.upsertVectors = async () => ({ status: 'completed' });
qdrantProvider.deleteByDocumentId = async () => ({ status: 'deleted' });

test.describe('Document Ingestion API Tests', () => {
  let facultyClient;

  test.before(async () => {
    await startTestServer();
    
    // Create and login as a faculty user
    facultyClient = new TestClient();
    await facultyClient.get('/auth/csrf-token');
    await facultyClient.post('/auth/register', {
      name: 'Faculty Member',
      college_id: 'FACULTY_TEST_UPL',
      password: 'Password@123',
      college_name: 'Test College',
      department: 'Computer Science',
      role: 'faculty',
    });
  });

  test.after(async () => {
    await stopTestServer();
  });

  test('1. Upload valid PDF → expect 202 + documentId', async () => {
    const formData = new FormData();
    const mockPdfBuffer = Buffer.from('%PDF-1.4 mock pdf contents for test');
    const fileBlob = new Blob([mockPdfBuffer], { type: 'application/pdf' });
    formData.append('file', fileBlob, 'syllabus.pdf');
    formData.append('scope', 'college_wide');

    const res = await facultyClient.post('/upload', formData);

    assert.strictEqual(res.status, 202);
    assert.ok(res.data.documentId);
    assert.strictEqual(res.data.message, 'File uploaded and processing started in background');
  });

  test('2. Poll status → expect eventual "completed"', async () => {
    // We upload another document to poll
    const formData = new FormData();
    const mockPdfBuffer = Buffer.from('%PDF-1.4 contents');
    const fileBlob = new Blob([mockPdfBuffer], { type: 'application/pdf' });
    formData.append('file', fileBlob, 'syllabus2.pdf');
    formData.append('scope', 'college_wide');

    const uploadRes = await facultyClient.post('/upload', formData);
    const docId = uploadRes.data.documentId;
    
    assert.ok(docId);

    // Poll status (retry up to 10 times with 100ms delay)
    let status = 'pending';
    for (let i = 0; i < 15; i++) {
      const statusRes = await facultyClient.get(`/upload/status/${docId}`);
      assert.strictEqual(statusRes.status, 200);
      status = statusRes.data.status;
      if (status === 'completed' || status === 'failed') {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    assert.strictEqual(status, 'completed');
  });

  test('3. Upload invalid file type → expect 400', async () => {
    const formData = new FormData();
    const mockTxtBuffer = Buffer.from('hello plain text');
    const fileBlob = new Blob([mockTxtBuffer], { type: 'text/plain' });
    formData.append('file', fileBlob, 'test.txt');

    const res = await facultyClient.post('/upload', formData);
    assert.strictEqual(res.status, 400); // Multer throws error on filter, caught by global handler
    assert.ok(res.data.error.includes('Allowed formats'));
  });

  test('4. Delete document → expect 200 + verify Qdrant vectors removed', async () => {
    // Get document list
    const listRes = await facultyClient.get('/upload/list');
    assert.strictEqual(listRes.status, 200);
    assert.ok(listRes.data.length > 0);
    
    const docToDelete = listRes.data[0];
    const docId = docToDelete._id || docToDelete.id;

    // Delete
    const deleteRes = await facultyClient.delete(`/upload/${docId}`);
    assert.strictEqual(deleteRes.status, 200);
    assert.strictEqual(deleteRes.data.message, 'Document and associated vectors deleted successfully');

    // Confirm deleted from list
    const afterListRes = await facultyClient.get('/upload/list');
    const exists = afterListRes.data.some(d => (d._id || d.id) === docId);
    assert.strictEqual(exists, false);
  });
});
