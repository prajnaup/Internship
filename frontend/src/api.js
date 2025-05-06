// frontend/src/api.js
import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:5000/api' // Ensure this points to your backend server
});

// Interceptor to potentially add auth tokens in the future if needed
API.interceptors.request.use((req) => {
  // Example: If you store tokens in localStorage for full authentication
  // const token = localStorage.getItem('authToken'); // Or however you store it
  // if (token) {
  //   req.headers.Authorization = `Bearer ${token}`;
  // }
  return req;
});

// Basic response interceptor for logging errors
API.interceptors.response.use(
  (response) => response,
  (error) => {
    // Log detailed error information
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('API Error Response Data:', error.response.data);
      console.error('API Error Response Status:', error.response.status);
      console.error('API Error Response Headers:', error.response.headers);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('API Error Request:', error.request);
      // Assign a more user-friendly message for network errors
      error.message = 'Network Error: Could not reach the server. Please check your connection and the backend server status.';
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('API Error Message:', error.message);
    }
    console.error('API Error Config:', error.config);

    // Return the promise rejection so calling code can handle it
    return Promise.reject(error);
  }
);

// --- Book Endpoints ---
export const fetchBooks = () => API.get('/books');
export const fetchBookDetails = (id) => API.get(`/books/${id}`);

// --- Auth Endpoints ---
export const googleLoginCheck = (payload) => API.post('/auth/google-login', payload);
export const completeProfile = (payload) => API.post('/auth/complete-profile', payload);

// --- Borrowing Endpoints ---
export const getBorrowStatus = (bookMongoId, userId) => API.get(`/borrow/status/${bookMongoId}/${userId}`);
export const borrowBook = (bookMongoId, payload) => API.post(`/borrow/${bookMongoId}`, payload);
export const returnBook = (recordId, payload) => API.post(`/borrow/return/${recordId}`, payload);
export const fetchMyBorrows = (userId) => API.get(`/borrow/user/${userId}/active`); // For Active Borrows
export const fetchMyHistory = (userId) => API.get(`/borrow/user/${userId}/history`); // *** NEW: For Borrow History ***

// --- REMOVED THE DEFAULT EXPORT ---
// export default API;