// frontend/src/App.js
import { useState, lazy, useEffect } from 'react'; // Import useEffect
import { Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider, googleLogout } from '@react-oauth/google';

const Home = lazy(() => import('./Home'));
const SignIn = lazy(() => import('./SignIn'));
const BookDetail = lazy(() => import('./BookDetail'));

const GOOGLE_CLIENT_ID = "922686403960-b35d1kb5da3fj4vbv057unj0srrnch25.apps.googleusercontent.com";

// Simple Loading Component
const InitialLoading = () => (
    <div className="loading-screen">Authenticating...</div>
);

function ProtectedRoute({ user, isLoading, children }) {
  if (isLoading) {
      return <InitialLoading />; // Show loading while checking auth
  }
  if (!user) {
    return <Navigate to="/signin" replace />;
  }
  return children;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true); // State to track initial auth check

  // --- Load user from localStorage on initial mount ---
  useEffect(() => {
    console.log("App mounting, checking localStorage for user...");
    setIsLoadingAuth(true); // Start loading
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        console.log("User found in localStorage, setting state.");
        setUser(JSON.parse(storedUser));
      } else {
        console.log("No user found in localStorage.");
      }
    } catch (error) {
        console.error("Failed to parse user from localStorage:", error);
        localStorage.removeItem('user'); // Clear corrupted data
    } finally {
        setIsLoadingAuth(false); // Finish loading check
    }
  }, []); // Empty array ensures this runs only once on mount

  // --- Update user state and localStorage ---
  const handleSetUser = (userData) => {
      if (userData) {
          console.log("Setting user state and saving to localStorage:", userData);
          localStorage.setItem('user', JSON.stringify(userData));
          setUser(userData);
      } else {
          // This case shouldn't happen via login flow, but good practice
          handleLogout(); // Ensure localStorage is cleared if setting user to null
      }
  };


  // --- Logout handler ---
  const handleLogout = () => {
     console.log("Logging out, clearing state and localStorage.");
     googleLogout();
     localStorage.removeItem('user'); // Clear persisted user data
     setUser(null);
  };

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
     <div className="min-h-screen">
       <Routes>
         <Route
           path="/signin"
           element={
             isLoadingAuth ? <InitialLoading /> : // Show loading screen initially
             user ? <Navigate to="/" replace /> : // If logged in, redirect from signin
             <SignIn setUser={handleSetUser} /> // Pass the enhanced setter
           }
         />
         <Route
           path="/"
           element={
             <ProtectedRoute user={user} isLoading={isLoadingAuth}>
               <Home user={user} onLogout={handleLogout} />
             </ProtectedRoute>
           }
         />
         <Route
           path="/books/:bookId"
           element={
             <ProtectedRoute user={user} isLoading={isLoadingAuth}>
               <BookDetail user={user} />
             </ProtectedRoute>
           }
         />
         {/* Optional: Catch-all route or redirect for unknown paths */}
         {/* <Route path="*" element={<Navigate to={user ? "/" : "/signin"} replace />} /> */}
       </Routes>
      </div>
    </GoogleOAuthProvider>
  );
}