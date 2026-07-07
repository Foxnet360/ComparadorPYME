// API Configuration
// Since frontend and backend are served from the same domain in production,
// we use relative URLs. Only use localhost in development.
const isLocal =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

export const API_BASE_URL = isLocal ? 'http://localhost:8080/api' : '/api';
