import api from './api';

export const getStats = () => api.get('/admin/stats');
export const getActivity = (limit = 20) => api.get('/admin/activity', { params: { limit } });
export const getHealth = () => api.get('/admin/health');
export const getUsers = (params) => api.get('/admin/users', { params });
export const createUser = (data) => api.post('/admin/users', data);
export const updateUser = (userId, data) => api.put(`/admin/users/${userId}`, data);
export const toggleUserActive = (userId, isActive) =>
  api.put(`/admin/users/${userId}`, { is_active: isActive });
export const deleteUser = (userId) => api.delete(`/admin/users/${userId}`);
export const getDocuments = (params) => api.get('/admin/documents', { params });

// Admin document delete — backend now exposes DELETE /admin/documents/{id}.
export const deleteDocument = (documentId) =>
  api.delete(`/admin/documents/${documentId}`);

// Admin document retry — re-enqueue a failed/pending doc.
export const retryDocument = (documentId) =>
  api.post(`/admin/documents/${documentId}/retry`);

// Model management.
export const getModelStatus = () => api.get('/admin/model');
export const setModel = (model) => api.post('/admin/model', { model });
export const clearModel = () => api.delete('/admin/model');

// AI quality summary (7-day grounded-answer rates, failed ingestions).
export const getQuality = () => api.get('/admin/quality');

// MCP tool surface exposed to the agent / external clients.
export const getMcpTools = () => api.get('/admin/mcp/tools');
