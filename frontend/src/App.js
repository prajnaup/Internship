// frontend/src/App.js
import { useState, lazy } from 'react'; // Import lazy
import { Routes, Route, Navigate } from 'react-router-dom'; // Import routing components
import { GoogleOAuthProvider, googleLogout } from '@react-oauth/google';

// Lazy load components for better performance
const Home = lazy(() => import('./Home'));
const SignIn = lazy(() => import('./SignIn'));
const BookDetail = lazy(() => import('./BookDetail')); // Add BookDetail

const GOOGLE_CLIENT_ID = "922686403960-b35d1kb5da3fj4vbv057unj0srrnch25.apps.googleusercontent.com";

// Helper component for protected routes
function ProtectedRoute({ user, children }) {
  if (!user) {
    // Redirect to login page if not logged in
    return <Navigate to="/signin" replace />;
  }
  return children; // Render the component if logged in
}

export default function App() {
  const [user, setUser] = useState(null);

  // Simple logout handler
  const handleLogout = () => {
     googleLogout(); // Recommended to clear Google's side too
     setUser(null); // Clear our app's user state
     console.log("User logged out.");
    // Optional: Redirect to sign-in after logout using navigate() from useNavigate if needed elsewhere
  };

  // The setUser function passed to SignIn implicitly handles login state update

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
     <div className="min-h-screen">
       <Routes>
         <Route
           path="/signin"
           element={user ? <Navigate to="/" replace /> : <SignIn setUser={setUser} />}
         />
         <Route
           path="/"
           element={
             <ProtectedRoute user={user}>
               <Home user={user} onLogout={handleLogout} />
             </ProtectedRoute>
           }
         />
         <Route
           path="/books/:bookId" // Route for book details
           element={
             <ProtectedRoute user={user}>
               <BookDetail user={user} /> {/* Pass user if needed in BookDetail */}
             </ProtectedRoute>
           }
         />
         {/* Optional: Add a catch-all route for 404 Not Found */}
         {/* <Route path="*" element={<NotFound />} /> */}
         {/* Redirect root to signin if not logged in (alternative to ProtectedRoute logic) */}
         {/* <Route path="/" element={user ? <Home user={user} onLogout={handleLogout} /> : <Navigate to="/signin" replace />} /> */}
       </Routes>
      </div>
    </GoogleOAuthProvider>
  );
}