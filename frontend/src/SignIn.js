// frontend/src/SignIn.js
import { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import jwtDecode from 'jwt-decode';
import API from './api'; 

export default function SignIn({ setUser }) {

  const [pendingUserInfo, setPendingUserInfo] = useState(null); // Stores { email } if completion needed
  const [formData, setFormData] = useState({ name: '', photo: '', phoneNumber: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false); // Add loading state

  const handleGoogleSuccess = async (credentialResponse) => {
    setError('');
    setIsLoading(true); // Start loading
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

      // Call the new backend endpoint to check user status
      console.log("Calling /google-login with:", { email, name, picture });
      const res = await API.post('/auth/google-login', { email, name, picture });
      console.log("Backend response from /google-login:", res.data);

      if (res.data.needsCompletion === false && res.data.user) {
        // User exists, log them in directly
        console.log("User exists, setting user state.");
        setUser(res.data.user);
        // No need to set pendingUserInfo or formData
      } else if (res.data.needsCompletion === true) {
        // User does not exist or needs profile completion
        console.log("User needs profile completion.");
        setPendingUserInfo({ email: res.data.email }); // Store email for form submission
        setFormData({ // Pre-fill form data with suggestions from backend
          name: res.data.suggestedName || '',
          photo: '', // Ensure the photo URL input is empty
          phoneNumber: '' // Phone number still needs to be entered
        });
        // The component will re-render showing the form
      } else {
         // Handle unexpected response format
         console.error("Unexpected response from /google-login", res.data);
         setError("An unexpected error occurred during login. Please try again.");
      }

    } catch (err) {
      console.error("Error during Google Sign-In or backend check:", err.response?.data || err.message || err);
      setError(err.response?.data?.message || "An error occurred during Google Sign-In. Please try again.");
      setPendingUserInfo(null); // Clear pending state on error
    } finally {
      setIsLoading(false); // Stop loading
    }
  };

  const handleGoogleError = () => {
    console.log('Google Login Failed');
    setError('Google Sign-In failed. Please try again.');
    setPendingUserInfo(null);
    setIsLoading(false); // Ensure loading stops on Google error too
  };


  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // This function is now only called when the form is displayed and submitted
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true); // Start loading for submission

    if (!pendingUserInfo?.email || !formData.name || !formData.phoneNumber) {
      setError('Please fill in all required fields (Name, Phone Number).');
      setIsLoading(false);
      return;
    }

    try {
      const payload = {
        email: pendingUserInfo.email, // Get email from the pending state
        name: formData.name,
        photo: formData.photo, // Include photo URL (can be empty)
        phoneNumber: formData.phoneNumber
      };
      console.log("Submitting profile data to /complete-profile:", payload);

      // Call the endpoint to create/save the profile
      const res = await API.post('/auth/complete-profile', payload);

      console.log("Backend response from /complete-profile:", res.data);
      if (res.data.user) {
        setUser(res.data.user); // Set the user state upon successful profile creation/update
        setPendingUserInfo(null); // Clear pending state
      } else {
         // Handle case where user data might be missing in response
         console.error("User data missing in response from /complete-profile");
         setError("Failed to retrieve user profile after saving. Please try logging in again.");
      }


    } catch (err) {
      console.error("Error submitting profile:", err.response?.data || err.message);
      setError(err.response?.data?.message || 'Failed to save profile. Please try again.');
    } finally {
      setIsLoading(false); // Stop loading
    }
  };


  return (
    <div className="container">
      {isLoading ? (
        <p className="loading-text">Loading...</p>
      ) : !pendingUserInfo ? (
        <div className="card">
          <h1 className="title">Login</h1>
          <p className="subtitle">Sign in with Google to continue.</p>
          <div className="button-container">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              useOneTap={false}
            />
          </div>
          {error && <p className="error-text">{error}</p>}
        </div>
      ) : (
        <div className="card">
          <h1 className="title">Complete Your Profile</h1>
          <p className="subtitle">Please provide the following details to finish setting up your account.</p>
          <p className="email-text">Email: <span>{pendingUserInfo.email}</span></p>
          <form onSubmit={handleProfileSubmit} className="form">
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
              {formData.photo && <img src={formData.photo} alt="Profile" className="avatar-preview" />}
            </div>
            {error && <p className="error-text">{error}</p>}
            <button type="submit" disabled={isLoading} className="submit-button">
              {isLoading ? 'Saving...' : 'Save Profile & Continue'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}