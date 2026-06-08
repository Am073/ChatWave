import api from './api';

export const getCalendarStatus = () => api.get('/calendar/status');

export const getAuthUrl = () => api.get('/calendar/auth');

export const syncCalendarEvent = (eventId) => api.post('/calendar/sync', { eventId });

export const getCalendarEvents = () => api.get('/calendar/events');

export const addEvent = (data) => api.post('/calendar/sync', data);
