import api from './api';

export const uploadDocument = (formData) =>
  api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

// FastAPI v2: document status lives at `/api/upload/{id}/status`
export const getDocumentStatus = (documentId) =>
  api.get(`/upload/${documentId}/status`);

export const listDocuments = () => api.get('/upload');

export const deleteDocument = (documentId) =>
  api.delete(`/upload/${documentId}`);