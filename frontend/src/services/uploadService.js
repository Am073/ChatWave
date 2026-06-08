import api from './api';

export const uploadDocument = (formData) =>
  api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const getDocumentStatus = (documentId) =>
  api.get(`/upload/status/${documentId}`);

export const listDocuments = () =>
  api.get('/upload/list');

export const deleteDocument = (documentId) =>
  api.delete(`/upload/${documentId}`);
