// frontend/src/App.js
import { useState, lazy, useEffect, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider, googleLogout } from '@react-oauth/google';

// Lazy load components
const Home = lazy(() => import('./Home'));
const SignIn = lazy(() => import('./SignIn'));
const BookDetail = lazy(() => import('./BookDetail'));
const MyBorrows = lazy(() => import('./MyBorrows'));
const LogoutConfirmModal = lazy(() => import('./LogoutConfirmModal')); // <-- Import the new modal

const GOOGLE_CLIENT_ID = "922686403960-b35d1kb5da3fj4vbv057unj0srrnch25.apps.googleusercontent.com";

// Simple Loading Component
const FullPageLoading = () => (
    <div className="loading-screen">Loading...</div>
);

// Protected Route Component
function ProtectedRoute({ user, isLoading, children }) {
  if (isLoading) {
      return <FullPageLoading />;
  }
  if (!user) {
    return <Navigate to="/signin" replace />;
  }
  return children;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [showLogoutConfirmModal, setShowLogoutConfirmModal] = useState(false); // <-- State for modal visibility

  useEffect(() => {
    // (Keep existing useEffect logic for checking localStorage)
    console.log("App mounting, checking localStorage for user...");
    setIsLoadingAuth(true);
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        if (parsedUser && parsedUser._id && parsedUser.email) {
            console.log("User found in localStorage, setting state:", parsedUser._id);
            setUser(parsedUser);
        } else {
             console.log("Invalid user data found in localStorage, clearing.");
             localStorage.removeItem('user');
        }
      } else {
        console.log("No user found in localStorage.");
      }
    } catch (error) {
        console.error("Failed to parse user from localStorage:", error);
        localStorage.removeItem('user');
    } finally {
        setIsLoadingAuth(false);
    }
  }, []);

  const handleSetUser = (userData) => {
      if (userData && userData._id) {
          console.log("Setting user state and saving to localStorage:", userData._id);
          localStorage.setItem('user', JSON.stringify(userData));
          setUser(userData);
      } else {
          console.log("Clearing user state due to invalid/null data.");
          // If setting invalid user, directly clear without confirmation
          handleConfirmLogout();
      }
  };

  // Renamed: Opens the confirmation modal
  const handleLogoutAttempt = () => {
    setShowLogoutConfirmModal(true); // Open the modal
  };

  // Renamed: Actual logout logic called by the modal's confirm button
  const handleConfirmLogout = () => {
    console.log("Confirmed logout, clearing state and localStorage.");
    googleLogout();
    localStorage.removeItem('user');
    setUser(null);
    setShowLogoutConfirmModal(false); // Close the modal
  };

  // Closes the modal without logging out
  const handleCancelLogout = () => {
    console.log("Logout cancelled.");
    setShowLogoutConfirmModal(false); // Close the modal
  };

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
     <Suspense fallback={<FullPageLoading />}>
       {/* Wrap everything including the modal */}
       <div className="min-h-screen">
         <Routes>
           <Route
             path="/signin"
             element={
               isLoadingAuth ? <FullPageLoading /> :
               user ? <Navigate to="/" replace /> :
               <SignIn setUser={handleSetUser} />
             }
           />
           <Route
             path="/"
             element={
               <ProtectedRoute user={user} isLoading={isLoadingAuth}>
                 {/* Pass handleLogoutAttempt to trigger the modal */}
                 <Home user={user} onLogout={handleLogoutAttempt} />
               </ProtectedRoute>
             }
           />
           <Route
             path="/books/:bookId"
             element={
               <ProtectedRoute user={user} isLoading={isLoadingAuth}>
                  {/* Pass handleLogoutAttempt to trigger the modal */}
                 <BookDetail user={user} onLogout={handleLogoutAttempt} />
               </ProtectedRoute>
             }
           />
            <Route
             path="/my-borrows"
             element={
               <ProtectedRoute user={user} isLoading={isLoadingAuth}>
                  {/* Pass handleLogoutAttempt to trigger the modal */}
                 <MyBorrows user={user} onLogout={handleLogoutAttempt}/>
               </ProtectedRoute>
             }
           />
           {/* Fallback route */}
           <Route path="*" element={<Navigate to={user ? "/" : "/signin"} replace />} />
         </Routes>

          {/* Render the Logout Confirmation Modal */}
          <LogoutConfirmModal
            isOpen={showLogoutConfirmModal}
            onConfirm={handleConfirmLogout}
            onCancel={handleCancelLogout}
          />
        </div>
      </Suspense>
    </GoogleOAuthProvider>
  );
}