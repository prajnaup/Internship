// frontend/src/AdminProtectedRoute.js
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

const FullPageLoading = () => (
    <div className="loading-screen">Loading...</div>
);

export default function AdminProtectedRoute({ user, isLoading, children }) {
  const location = useLocation();

  if (isLoading) {
    return <FullPageLoading />;
  }

  if (!user) {
    // Not logged in, redirect to signin
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }

  if (user.role !== 'admin') {
    // Logged in but not an admin, redirect to user home with message
    return <Navigate to="/" state={{ message: "Unauthorized Access. Admins only.", messageType: "error", from: location }} replace />;
  }

  // User is admin, render the children
  return children;
}