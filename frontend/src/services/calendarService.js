import api from './api';

export const getCalendarStatus = () => api.get('/calendar/status');

export const getAuthUrl = () => api.get('/calendar/auth');

// FIX[5]: POST /calendar/sync does not exist in backend
export const syncCalendarEvent = (eventId) => {
  console.warn(`[FIX5] POST /api/calendar/sync is not implemented.`);
  alert('This feature is not yet available.');
  return Promise.resolve();
};

export const addEvent = (data) => api.post('/calendar/events', data);

// FIX[5]: DELETE /calendar/disconnect does not exist in backend
export const disconnectCalendar = () => {
  console.warn('[FIX5] DELETE /api/calendar/disconnect is not implemented.');
  alert('This feature is not yet available.');
  return Promise.resolve();
};
