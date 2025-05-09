// frontend/src/api.js
import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:5000/api'
});

// Helper to get admin user ID from localStorage
const getAdminUserId = () => {
  try {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      if (parsedUser && parsedUser._id && parsedUser.role === 'admin') {
        return parsedUser._id;
      }
    }
  } catch (e) {
    console.error("Error getting admin user ID from localStorage", e);
  }
  return null;
};


API.interceptors.request.use((req) => {
  // For admin routes, add admin user ID header if available
  if (req.url.startsWith('/admin')) {
    const adminId = getAdminUserId();
    if (adminId) {
      req.headers['x-admin-user-id'] = adminId;
    } else {
      console.warn('Admin action attempted without admin user ID. This might be blocked by backend.');
      // Optionally, you could cancel the request here if no adminId and it's an admin route
      // return Promise.reject(new Error("Admin ID not found for admin-only request"));
    }
  }
  return req;
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      console.error('API Error Response Data:', error.response.data);
      console.error('API Error Response Status:', error.response.status);
      console.error('API Error Response Headers:', error.response.headers);
    } else if (error.request) {
      console.error('API Error Request:', error.request);
      error.message = 'Network Error: Could not reach the server. Please check your connection and the backend server status.';
    } else {
      console.error('API Error Message:', error.message);
    }
    console.error('API Error Config:', error.config);
    return Promise.reject(error);
  }
);

// --- Book Endpoints (Public) ---
export const fetchBooks = () => API.get('/books');
export const fetchBookDetails = (id) => API.get(`/books/${id}`);

// --- Auth Endpoints ---
export const googleLoginCheck = (payload) => API.post('/auth/google-login', payload);
export const completeProfile = (payload) => API.post('/auth/complete-profile', payload);

// --- Borrowing Endpoints (User) ---
export const getBorrowStatus = (bookMongoId, userId) => API.get(`/borrow/status/${bookMongoId}/${userId}`);
export const borrowBook = (bookMongoId, payload) => API.post(`/borrow/${bookMongoId}`, payload);
export const returnBook = (recordId, payload) => API.post(`/borrow/return/${recordId}`, payload);
export const fetchMyBorrows = (userId) => API.get(`/borrow/user/${userId}/active`);
export const fetchMyHistory = (userId) => API.get(`/borrow/user/${userId}/history`);

// --- Admin Book Management Endpoints ---
export const adminAddBook = (bookData) => API.post('/admin/books/add', bookData);
export const adminEditBook = (bookId, bookData) => API.put(`/admin/books/edit/${bookId}`, bookData);
export const adminDeleteBook = (bookId) => API.delete(`/admin/books/delete/${bookId}`);
export const adminFetchAllBooks = () => API.get('/admin/books'); // Assuming you'll want an endpoint to get ALL books for admin view

// --- Admin User Management Endpoints ---
export const adminFetchUsers = () => API.get('/admin/users');
export const adminBlockUser = (userId, adminActingId) => API.post(`/admin/users/block/${userId}`, { adminUserId: adminActingId }); // Pass adminId for middleware
export const adminUnblockUser = (userId, adminActingId) => API.post(`/admin/users/unblock/${userId}`, { adminUserId: adminActingId });
export const adminFetchUserBorrows = (userId) => API.get(`/admin/users/${userId}/borrows`);

// --- Admin Overdue Users Endpoint ---
export const adminFetchOverdueUsers = () => API.get('/admin/overdue-users');