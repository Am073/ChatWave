import api from './api';

export const getAnnouncements = (params = {}) => api.get('/announcements', { params });

export const markAsRead = (id) => api.put(`/announcements/${id}/read`);

export const postAnnouncement = (data) => api.post('/announcements', data);

export const deleteAnnouncement = (id) => api.delete(`/announcements/${id}`);
