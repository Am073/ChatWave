import api from './api';

export const getStats = () => api.get('/admin/stats');

export const getActivity = (limit = 20) => api.get('/admin/activity', { params: { limit } });

export const getHealth = () => api.get('/admin/health');

export const getUsers = (params) => api.get('/admin/users', { params });

export const createUser = (data) => api.post('/admin/users', data);

export const updateUser = (userId, data) => api.put(`/admin/users/${userId}`, data);

export const toggleUserActive = (userId, isActive) => api.put(`/admin/users/${userId}`, { is_active: isActive });

export const deleteUser = (userId) => api.delete(`/admin/users/${userId}`);

export const getDocuments = (params) => api.get('/admin/documents', { params });

// FIX[5]: DELETE /admin/documents/{id} does not exist in backend
export const deleteDocument = (documentId) => {
  console.warn(`[FIX5] DELETE /api/admin/documents/${documentId} is not implemented.`);
  alert('This feature is not yet available.');
  return Promise.resolve();
};

// FIX[5]: POST /admin/seed does not exist in backend
export const triggerSeed = () => {
  console.warn('[FIX5] POST /api/admin/seed is not implemented.');
  alert('This feature is not yet available.');
  return Promise.resolve();
};
