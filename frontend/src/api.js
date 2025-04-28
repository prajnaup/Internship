import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:5000/api' 
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response || error.message);
    return Promise.reject(error);
  }
);

export default API;