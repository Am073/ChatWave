import api from './api';

export const login = async (college_id, password, role) => {
  const res = await api.post('/auth/login', { college_id, password, role });
  return res.data;
};

export const register = async (data) => {
  const res = await api.post('/auth/register', data);
  return res.data;
};

export const changePassword = async (oldPassword, newPassword) => {
  const res = await api.post('/auth/change-password', {
    oldPassword,
    newPassword,
  });
  return res.data;
};

export const getCsrfToken = async () => {
  const res = await api.get('/auth/csrf-token');
  return res.data.csrfToken;
};