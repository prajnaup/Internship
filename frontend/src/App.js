// frontend/src/App.js
import { useState, lazy, useEffect, Suspense } from 'react'; // Import Suspense
import { Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider, googleLogout } from '@react-oauth/google';

// Lazy load components
const Home = lazy(() => import('./Home'));
const SignIn = lazy(() => import('./SignIn'));
const BookDetail = lazy(() => import('./BookDetail'));
const MyBorrows = lazy(() => import('./MyBorrows')); // <-- Import MyBorrows

const GOOGLE_CLIENT_ID = "922686403960-b35d1kb5da3fj4vbv057unj0srrnch25.apps.googleusercontent.com"; // Use your actual client ID

// Simple Loading Component
const FullPageLoading = () => (
    <div className="loading-screen">Loading...</div> // Simplified message
);

// Protected Route Component (remains the same)
function ProtectedRoute({ user, isLoading, children }) {
  if (isLoading) {
      return <FullPageLoading />;
  }
  if (!user) {
    // Redirect them to the /signin page, but save the current location they were
    // trying to go to when they were redirected. This allows us to send them
    // along to that page after they login, which is a nicer user experience
    // than dropping them off on the home page.
    // Note: You might need to handle the 'from' state in SignIn component upon successful login.
    return <Navigate to="/signin" replace />;
  }
  return children;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true); // Start true to check storage

  useEffect(() => {
    console.log("App mounting, checking localStorage for user...");
    setIsLoadingAuth(true);
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        // Basic validation: ensure it has an _id and email, add more if needed
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
        localStorage.removeItem('user'); // Clear invalid data
    } finally {
        setIsLoadingAuth(false); // Finished checking
    }
  }, []); // Empty dependency array ensures this runs only once on mount

  const handleSetUser = (userData) => {
      if (userData && userData._id) { // Ensure userData is valid and has an ID
          console.log("Setting user state and saving to localStorage:", userData._id);
          localStorage.setItem('user', JSON.stringify(userData));
          setUser(userData);
      } else {
          console.log("Clearing user state due to invalid/null data.");
          handleLogout(); // Trigger full logout if invalid data is passed
      }
  };

  const handleLogout = () => {
     console.log("Logging out, clearing state and localStorage.");
     googleLogout(); // Ensure Google session is terminated if applicable
     localStorage.removeItem('user');
     setUser(null);
     // Optionally navigate to sign-in page after logout
     // window.location.href = '/signin'; // Or use navigate() if within Router context
  };

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
     {/* Use Suspense higher up to handle lazy loading fallbacks */}
     <Suspense fallback={<FullPageLoading />}>
       <div className="min-h-screen"> {/* Ensure this class exists if using Tailwind or similar */}
         <Routes>
           <Route
             path="/signin"
             element={
               isLoadingAuth ? <FullPageLoading /> : // Show loading until auth check is complete
               user ? <Navigate to="/" replace /> :  // If logged in, redirect from /signin to /
               <SignIn setUser={handleSetUser} />
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
                 <BookDetail user={user} onLogout={handleLogout} /> {/* Pass onLogout */}
               </ProtectedRoute>
             }
           />
           {/* ADDED: Route for MyBorrows */}
            <Route
             path="/my-borrows"
             element={
               <ProtectedRoute user={user} isLoading={isLoadingAuth}>
                 <MyBorrows user={user} onLogout={handleLogout}/>
               </ProtectedRoute>
             }
           />
           {/* Fallback route */}
           <Route path="*" element={<Navigate to={user ? "/" : "/signin"} replace />} />
         </Routes>
        </div>
      </Suspense>
    </GoogleOAuthProvider>
  );
}