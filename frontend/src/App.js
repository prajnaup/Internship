import { useState } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import Home from './Home';
import SignIn from './SignIn';

export default function App() {
  const [user, setUser] = useState(null);

  return (
    <GoogleOAuthProvider clientId="922686403960-b35d1kb5da3fj4vbv057unj0srrnch25.apps.googleusercontent.com">
      {user ? <Home user={user} /> : <SignIn setUser={setUser} />}
    </GoogleOAuthProvider>
  );
}

