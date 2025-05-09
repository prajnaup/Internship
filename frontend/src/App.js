// frontend/src/App.js
import { useState, lazy, useEffect, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { GoogleOAuthProvider, googleLogout } from '@react-oauth/google';

// Eager load critical components for auth flow
import SignIn from './SignIn'; 
import LogoutConfirmModal from './LogoutConfirmModal';

// Lazy load other components
const Home = lazy(() => import('./Home'));
const BookDetail = lazy(() => import('./BookDetail'));
const MyBorrows = lazy(() => import('./MyBorrows'));

// Lazy load Admin components
const AdminLayout = lazy(() => import('./admin/AdminLayout'));
const AdminDashboard = lazy(() => import('./admin/AdminDashboard'));
const ManageBooks = lazy(() => import('./admin/ManageBooks'));
const UserManagement = lazy(() => import('./admin/UserManagement'));
const OverdueUsers = lazy(() => import('./admin/OverdueUsers'));
const AdminProtectedRoute = lazy(() => import('./AdminProtectedRoute'));


const GOOGLE_CLIENT_ID = "922686403960-b35d1kb5da3fj4vbv057unj0srrnch25.apps.googleusercontent.com";

const FullPageLoading = () => (
    <div className="loading-screen">Loading...</div>
);

// User Protected Route (no changes)
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
  const [user, setUserState] = useState(null); // Renamed to avoid conflict with user prop
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [showLogoutConfirmModal, setShowLogoutConfirmModal] = useState(false);
  const [flashMessage, setFlashMessage] = useState(null); // For unauthorized access messages

  const location = useLocation();
  const navigate = useNavigate(); // For clearing flash message state

  // Effect to handle flash messages passed via route state
  useEffect(() => {
    if (location.state?.message) {
        setFlashMessage({ text: location.state.message, type: location.state.messageType || 'info' });
        // Clear message from location state to prevent re-showing on refresh/navigation
        navigate(location.pathname, { state: {}, replace: true });

        const timer = setTimeout(() => setFlashMessage(null), 5000); // Auto-hide after 5s
        return () => clearTimeout(timer);
    }
  }, [location.state, navigate, location.pathname]);


  useEffect(() => {
    console.log("App mounting, checking localStorage for user...");
    setIsLoadingAuth(true);
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        // Ensure role and isBlocked are part of the check for a "valid" user
        if (parsedUser && parsedUser._id && parsedUser.email && parsedUser.role != null) {
            console.log("User found in localStorage, setting state:", parsedUser._id, "Role:", parsedUser.role);
            setUserState(parsedUser);
        } else {
             console.log("Invalid user data found in localStorage (missing _id, email, or role), clearing.");
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
      // Ensure role and isBlocked are handled
      if (userData && userData._id && userData.role != null) {
          console.log("Setting user state and saving to localStorage:", userData._id, "Role:", userData.role);
          localStorage.setItem('user', JSON.stringify(userData));
          setUserState(userData);
          // Admin redirect handled in SignIn directly, user redirect here
          if (userData.role !== 'admin') {
            // navigate('/'); // Let ProtectedRoute handle this or SignIn
          }
      } else if (userData === null) { // Explicit logout or clearing
          console.log("Clearing user state due to null data (logout).");
          handleConfirmLogout(); // Use existing logout logic
      } else {
          console.warn("Attempted to set invalid user data:", userData);
          // Potentially clear user if data is malformed but not null
          // This case should ideally not happen if backend/SignIn are correct
      }
  };

  const handleLogoutAttempt = () => {
    setShowLogoutConfirmModal(true);
  };

  const handleConfirmLogout = () => {
    console.log("Confirmed logout, clearing state and localStorage.");
    googleLogout();
    localStorage.removeItem('user');
    setUserState(null);
    setShowLogoutConfirmModal(false);
    navigate('/signin'); // Redirect to signin on logout
  };

  const handleCancelLogout = () => {
    setShowLogoutConfirmModal(false);
  };

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
     <Suspense fallback={<FullPageLoading />}>
       <div className="min-h-screen">
         {flashMessage && ( /* Display flash message at app root */
            <div className={`app-flash-message ${flashMessage.type}`}>
                {flashMessage.text}
                <button onClick={() => setFlashMessage(null)}>×</button>
            </div>
          )}
         <Routes>
           <Route
             path="/signin"
             element={
               isLoadingAuth ? <FullPageLoading /> :
               user ? (user.role === 'admin' ? <Navigate to="/admin/manage-books" replace /> : <Navigate to="/" replace />) :
               <SignIn setUser={handleSetUser} />
             }
           />
           
           {/* User Routes */}
           <Route
             path="/"
             element={
               <ProtectedRoute user={user} isLoading={isLoadingAuth}>
                 <Home user={user} onLogout={handleLogoutAttempt} />
               </ProtectedRoute>
             }
           />
           <Route
             path="/books/:bookId"
             element={
               <ProtectedRoute user={user} isLoading={isLoadingAuth}>
                 <BookDetail user={user} onLogout={handleLogoutAttempt} />
               </ProtectedRoute>
             }
           />
            <Route
             path="/my-borrows"
             element={
               <ProtectedRoute user={user} isLoading={isLoadingAuth}>
                 <MyBorrows user={user} onLogout={handleLogoutAttempt}/>
               </ProtectedRoute>
             }
           />

            {/* Admin Routes */}
            <Route 
              path="/admin"
              element={
                <AdminProtectedRoute user={user} isLoading={isLoadingAuth}>
                  <AdminLayout user={user} setUser={handleSetUser /* Pass setUser for admin logout */} />
                </AdminProtectedRoute>
              }
            >
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="manage-books" element={<ManageBooks adminUser={user} />} />
              <Route path="user-management" element={<UserManagement adminUser={user} />} />
              <Route path="overdue-users" element={<OverdueUsers adminUser={user} />} />
              <Route index element={<Navigate to="dashboard" replace />} /> {/* Default admin to dashboard */}
            </Route>

           {/* Fallback route */}
           <Route path="*" element={
             isLoadingAuth ? <FullPageLoading /> :
             <Navigate to={user ? (user.role === 'admin' ? "/admin/dashboard" : "/") : "/signin"} replace />
            } />
         </Routes>

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