// frontend/src/App.js
import { useState } from 'react';
import { GoogleOAuthProvider, googleLogout } from '@react-oauth/google';
import Home from './Home';
import SignIn from './SignIn';
// Removed Spinner import here as it's not used directly in App anymore

const GOOGLE_CLIENT_ID = "922686403960-b35d1kb5da3fj4vbv057unj0srrnch25.apps.googleusercontent.com";

export default function App() {
  const [user, setUser] = useState(null);
  // Removed loadingInitial state for simplicity now

  // Simple logout handler
  const handleLogout = () => {
     googleLogout(); // Recommended to clear Google's side too
     setUser(null); // Clear our app's user state
     console.log("User logged out.");
  };

  // The setUser function passed to SignIn implicitly handles login state update

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div className="min-h-screen"> {/* Removed bg-gray-100, components handle their own bg */}
        {user ? (
          <Home user={user} onLogout={handleLogout} /> // Pass handleLogout
        ) : (
          <SignIn setUser={setUser} /> // Pass the state setter
        )}
      </div>
    </GoogleOAuthProvider>
  );
}