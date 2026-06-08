import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

// Helper to read a cookie value by name
const getCookie = (name) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
};

// Request Interceptor: Attach CSRF Token from cookie
api.interceptors.request.use(
  (config) => {
    const csrfToken = getCookie('csrf_token');
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Auto refresh token on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        // Attempt session refresh
        await axios.post('/api/auth/refresh', {}, { withCredentials: true });
        
        // Retry the original request
        return api(originalRequest);
      } catch (refreshError) {
        console.error('Session refresh failed:', refreshError);
        // Dispatch custom logout event if session cannot be recovered
        window.dispatchEvent(new Event('auth:logout'));
        return Promise.reject(error);
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;