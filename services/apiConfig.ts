// API Configuration
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// Backend URL - Railway for production
export const API_BASE_URL = isLocal 
  ? 'http://localhost:8080/api' 
  : 'https://comparadorpyme-production.up.railway.app/api';
