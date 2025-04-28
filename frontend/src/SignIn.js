// frontend/src/SignIn.js
import { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import jwtDecode from 'jwt-decode';
import API from './api';

export default function SignIn({ setUser }) { // Receives the enhanced handleSetUser

  const [pendingUserInfo, setPendingUserInfo] = useState(null);
  const [formData, setFormData] = useState({ name: '', photo: '', phoneNumber: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSuccess = async (credentialResponse) => {
    setError('');
    setIsLoading(true);
    try {
      const decoded = jwtDecode(credentialResponse.credential);
      console.log("Google JWT Decoded:", decoded);
      const { email, name, picture } = decoded;

      if (!email) {
        console.error("Email not found in Google credential");
        setError("Failed to get email from Google. Please try again.");
        setIsLoading(false);
        return;
      }

      console.log("Calling /google-login with:", { email, name, picture });
      const res = await API.post('/auth/google-login', { email, name, picture });
      console.log("Backend response from /google-login:", res.data);

      if (res.data.needsCompletion === false && res.data.user) {
        console.log("User exists, setting user state.");
        // Use the passed setter function which handles localStorage
        setUser(res.data.user);
      } else if (res.data.needsCompletion === true) {
        console.log("User needs profile completion.");
        setPendingUserInfo({ email: res.data.email });
        setFormData({
          name: res.data.suggestedName || '',
          photo: '',
          phoneNumber: ''
        });
      } else {
         console.error("Unexpected response from /google-login", res.data);
         setError("An unexpected error occurred during login. Please try again.");
      }

    } catch (err) {
      console.error("Error during Google Sign-In or backend check:", err.response?.data || err.message || err);
      setError(err.response?.data?.message || "An error occurred during Google Sign-In. Please try again.");
      setPendingUserInfo(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleError = () => {
    console.log('Google Login Failed');
    setError('Google Sign-In failed. Please try again.');
    setPendingUserInfo(null);
    setIsLoading(false);
  };


  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!pendingUserInfo?.email || !formData.name || !formData.phoneNumber) {
      setError('Please fill in all required fields (Name, Phone Number).');
      setIsLoading(false);
      return;
    }

    try {
      const payload = {
        email: pendingUserInfo.email,
        name: formData.name,
        photo: formData.photo,
        phoneNumber: formData.phoneNumber
      };
      console.log("Submitting profile data to /complete-profile:", payload);

      const res = await API.post('/auth/complete-profile', payload);

      console.log("Backend response from /complete-profile:", res.data);
      if (res.data.user) {
        // Use the passed setter function which handles localStorage
        setUser(res.data.user);
        setPendingUserInfo(null);
      } else {
         console.error("User data missing in response from /complete-profile");
         setError("Failed to retrieve user profile after saving. Please try logging in again.");
      }

    } catch (err) {
      console.error("Error submitting profile:", err.response?.data || err.message);
      setError(err.response?.data?.message || 'Failed to save profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };


  return (
    // Container now primarily centers content vertically/horizontally
    // The background gradient is on the body
    <div className="container">
      {isLoading && !pendingUserInfo ? ( // Show specific loading for Google button click
         <div className="card"><p className="loading-text">Authenticating with Google...</p></div>
      ) : isLoading && pendingUserInfo ? ( // Show loading for profile submit
          <div className="card"><p className="loading-text">Saving Profile...</p></div>
      ) : !pendingUserInfo ? (
        // --- Sign In Card ---
        <div className="card sign-in-card"> {/* Added specific class */}
          <h1 className="title">Welcome Back!</h1>
          <p className="subtitle">Sign in with Google to continue.</p>
          {/* --- Added Text --- */}
          <p className="sign-in-description">
            Access your borrowed books, discover new reads, and keep track of your literary journey.
          </p>
          <div className="button-container">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              useOneTap={false} // Set to true if you want One Tap UI
              theme="outline" // Options: outline, filled_blue, filled_black
              size="large" // Options: small, medium, large
              shape="rectangular" // Options: rectangular, square, circle, pill
            />
          </div>
          {error && <p className="error-text sign-in-error">{error}</p>}
        </div>
      ) : (
        // --- Complete Profile Card ---
        <div className="card">
          <h1 className="title">Complete Your Profile</h1>
          <p className="subtitle">Just a few more details to get you started.</p>
          <p className="email-text">Email: <span>{pendingUserInfo.email}</span></p>
          <form onSubmit={handleProfileSubmit} className="form">
            {/* Form groups remain the same */}
            <div className="form-group">
              <label htmlFor="name">Name <span>*</span></label>
              <input id="name" type="text" name="name" value={formData.name} onChange={handleInputChange} required />
            </div>
            <div className="form-group">
              <label htmlFor="phoneNumber">Phone Number <span>*</span></label>
              <input id="phoneNumber" type="tel" name="phoneNumber" value={formData.phoneNumber} onChange={handleInputChange} required />
            </div>
            <div className="form-group">
              <label htmlFor="photo">Photo URL</label>
              <input id="photo" type="url" name="photo" value={formData.photo} onChange={handleInputChange} />
              {formData.photo && <img src={formData.photo} alt="Profile Preview" className="avatar-preview" />}
            </div>
            {error && <p className="error-text profile-error">{error}</p>}
            <button type="submit" disabled={isLoading} className="button submit-button">
              {isLoading ? 'Saving...' : 'Save Profile & Continue'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}