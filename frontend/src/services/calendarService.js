import api from './api';

export const getCalendarStatus = () => api.get('/calendar/status');
export const getAuthUrl = () => api.get('/calendar/auth');
export const listEvents = (params = {}) => api.get('/calendar/events', { params });
export const addEvent = (data) => api.post('/calendar/events', data);
export const deleteEvent = (eventId) => api.delete(`/calendar/events/${eventId}`);
export const syncCalendar = () => api.post('/calendar/sync');
export const disconnectCalendar = () => api.delete('/calendar/disconnect');

// Smart date detection: scan a chat answer + cited snippets for
// calendar-worthy dates.
export const extractDates = (payload) => api.post('/calendar/extract-dates', payload);

// Bulk-create multiple Google Calendar events in a single call.
export const bulkAddEvents = (events) => api.post('/calendar/events/bulk', { events });
