// src/SignIn.js
import { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import jwtDecode from 'jwt-decode'; // Change this line to use the default export
import API from './api'; // Ensure API base URL is correct

export default function SignIn({ setUser }) {
  // State to hold user info during the multi-step process
  const [pendingUserInfo, setPendingUserInfo] = useState(null); // { email, name?, photo? }
  const [formData, setFormData] = useState({ name: '', photo: '', phoneNumber: '' });
  const [error, setError] = useState('');

  // Step 1: Google Sign-In Success - Just get the email (and maybe prefill)
  const handleGoogleSuccess = (credentialResponse) => {
    setError(''); // Clear previous errors
    try {
      const decoded = jwtDecode(credentialResponse.credential);
      console.log("Google JWT Decoded:", decoded);
      const { email, name, picture } = decoded;

      if (!email) {
        console.error("Email not found in Google credential");
        setError("Failed to get email from Google. Please try again.");
        return;
      }

      // Store email and potentially prefill form data
      setPendingUserInfo({ email });
      setFormData({
          name: name || '', // Prefill if available
          photo: picture || '', // Prefill if available
          phoneNumber: '' // Phone number always needs input
      });

    } catch (err) {
      console.error("Error decoding Google credential:", err);
      setError("An error occurred during Google Sign-In. Please try again.");
    }
  };

  const handleGoogleError = () => {
    console.log('Google Login Failed');
    setError('Google Sign-In failed. Please try again.');
    setPendingUserInfo(null); // Reset state on failure
  };

  // Step 2: Handle input changes in the manual form
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Step 3: Submit the completed profile form to the backend
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setError(''); // Clear previous errors

    if (!pendingUserInfo?.email || !formData.name || !formData.phoneNumber) {
      setError('Please fill in all required fields (Name, Phone Number).');
      return;
    }

    try {
      // Send email (from Google) + name, photo, phoneNumber (from form)
      const payload = {
        email: pendingUserInfo.email,
        name: formData.name,
        photo: formData.photo, // Send photo URL, even if empty
        phoneNumber: formData.phoneNumber
      };
      console.log("Submitting profile data:", payload);

      // Call the NEW backend endpoint
      const res = await API.post('/auth/complete-profile', payload);

      console.log("Backend response:", res.data);
      setUser(res.data.user); // Set the user state in App.js
      setPendingUserInfo(null); // Clear pending state

    } catch (err) {
      console.error("Error submitting profile:", err.response?.data || err.message);
      setError(err.response?.data?.message || 'Failed to save profile. Please try again.');
    }
  };

  // Render logic: Show Google Login OR the profile completion form
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      {!pendingUserInfo ? (
        // STEP 1: Show Google Login Button
        <>
          <h1 className="text-3xl mb-6 font-semibold text-gray-700">Sign In / Register</h1>
          <p className="mb-4 text-gray-600">Sign in with Google to continue.</p>
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={handleGoogleError}
            useOneTap={false} // You might want to disable one-tap if you always show the form
            scope="profile email"
          />
          {error && <p className="mt-4 text-red-500">{error}</p>}
        </>
      ) : (
        // STEP 2: Show Profile Completion Form
        <>
          <h1 className="text-3xl mb-6 font-semibold text-gray-700">Complete Your Profile</h1>
          <p className="mb-4 text-gray-600">Please provide the following details.</p>
          <p className="mb-4 text-sm text-gray-500">Email: {pendingUserInfo.email}</p>
          <form onSubmit={handleProfileSubmit} className="w-full max-w-sm flex flex-col gap-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">: </span></label>
              <input
                id="name"
                type="text"
                name="name"
                placeholder="Your Full Name"
                value={formData.name}
                onChange={handleInputChange}
                required
                className="w-full border border-gray-300 p-2 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-1">Phone Number <span className="text-red-500">: </span></label>
              <input
                id="phoneNumber"
                type="tel" // Use 'tel' type for better mobile usability
                name="phoneNumber"
                placeholder="e.g., +91 9876543210"
                value={formData.phoneNumber}
                onChange={handleInputChange}
                required
                className="w-full border border-gray-300 p-2 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label htmlFor="photo" className="block text-sm font-medium text-gray-700 mb-1">Photo URL: </label>
              <input
                id="photo"
                type="url" // Use 'url' type for basic validation
                name="photo"
                placeholder="https://example.com/your-photo.jpg"
                value={formData.photo}
                onChange={handleInputChange}
                className="w-full border border-gray-300 p-2 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {error && <p className="mt-1 text-red-500 text-sm">{error}</p>}

            <button
              type="submit"
              className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out"
            >
              Save Profile & Continue
            </button>
          </form>
        </>
      )}
    </div>
  );
}