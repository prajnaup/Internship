// frontend/src/api.js
import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:5000/api' // Verify this matches your backend setup
});

// Optional: Add interceptor to handle errors globally or attach tokens if needed later
API.interceptors.response.use(
  (response) => response,
  (error) => {
    // You can add more sophisticated error handling here
    console.error('API Error:', error.response || error.message);
    return Promise.reject(error);
  }
);

export default API;