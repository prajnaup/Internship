// frontend/src/SignIn.js
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import Webcam from 'react-webcam';
import jwtDecode from 'jwt-decode';
import * as faceapi from 'face-api.js'; // Import face-api
import * as api from './api';
import './styles.css';

const Spinner = () => <div className="spinner"></div>;

export default function SignIn({ setUser }) {
    const [pendingUserInfo, setPendingUserInfo] = useState(null);
    const [formData, setFormData] = useState({ name: '', phoneNumber: '' });
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false); // General loading state for submission
    const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);

    const webcamRef = useRef(null);
    const [capturedPhoto, setCapturedPhoto] = useState(null);
    const [cameraError, setCameraError] = useState(null);

    // --- NEW State for face-api.js ---
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [modelsLoadingError, setModelsLoadingError] = useState(null);
    const [isDetecting, setIsDetecting] = useState(false); // State during detection attempt
    const [faceDetectionError, setFaceDetectionError] = useState(''); // Specific error for face detection
    const [photoCaptureStage, setPhotoCaptureStage] = useState('idle'); // idle, loadingModels, capturing, detecting, captured, submitting

    // --- Load face-api Models ---
    useEffect(() => {
        // Only load models if the user needs to complete their profile and models aren't loaded
        if (pendingUserInfo && !modelsLoaded && photoCaptureStage !== 'loadingModels' && !modelsLoadingError) {
            const loadModels = async () => {
                const MODEL_URL = '/models'; // Path relative to the public directory
                setPhotoCaptureStage('loadingModels');
                setModelsLoadingError(null);
                console.log('Loading face-api models...');
                try {
                    // Make sure tf backend is initialized (optional but good practice)
                    await faceapi.tf.ready();
                    console.log('TensorFlow backend ready.');

                    await Promise.all([
                        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                        faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
                        // Add more models here if needed later (e.g., faceExpressionNet)
                    ]);
                    console.log('Face-api models loaded successfully.');
                    setModelsLoaded(true);
                    setPhotoCaptureStage('capturing'); // Move to capturing stage once models are ready
                } catch (err) {
                    console.error('Error loading face-api models:', err);
                    setModelsLoadingError('Could not load face detection models. Please try refreshing the page.');
                    setPhotoCaptureStage('idle'); // Revert stage on error
                }
            };
            loadModels();
        }
        // Cleanup function (optional, might help in strict mode)
        // return () => {
        //     // Potentially dispose models if component unmounts during loading?
        //     // faceapi.tf.dispose(); // Be careful with this, might affect other components
        // };
    }, [pendingUserInfo, modelsLoaded, photoCaptureStage, modelsLoadingError]); // Rerun if user info appears or stage resets or error occurs

    // --- Google Handlers (Unchanged) ---
    const handleGoogleSuccess = async (credentialResponse) => {
        setError('');
        setIsLoadingGoogle(true);
        setPendingUserInfo(null);
        setCapturedPhoto(null);
        setPhotoCaptureStage('idle'); // Reset stage
        setCameraError(null);
        setModelsLoaded(false); // Reset model loaded status
        setModelsLoadingError(null);
        setFaceDetectionError('');

        try {
            const decoded = jwtDecode(credentialResponse.credential);
            const { email, name } = decoded;

            if (!email) throw new Error("Failed to get email from Google.");

            console.log("Calling /google-login with:", { email, name });
            const res = await api.googleLoginCheck({ email, name });

            if (res.data.needsCompletion === false && res.data.user) {
                setUser(res.data.user);
            } else if (res.data.needsCompletion === true) {
                setPendingUserInfo({ email: res.data.email });
                setFormData({ name: res.data.suggestedName || '', phoneNumber: '' });
                // Don't set to 'capturing' yet, wait for models to load via useEffect
                setPhotoCaptureStage('idle');
            } else {
                throw new Error("Unexpected response from server during login check.");
            }
        } catch (err) {
            console.error("Error during Google Sign-In or backend check:", err.response?.data || err.message || err);
            setError(err.response?.data?.message || "An error occurred during Google Sign-In. Please try again.");
            setPendingUserInfo(null);
            setPhotoCaptureStage('idle');
        } finally {
            setIsLoadingGoogle(false);
        }
    };

    const handleGoogleError = () => {
        console.log('Google Login Failed');
        setError('Google Sign-In failed. Please try again.');
        setPendingUserInfo(null);
        setIsLoadingGoogle(false);
        setPhotoCaptureStage('idle');
    };

    // --- Input Handler (Unchanged) ---
     const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (name === 'phoneNumber' && (error.includes('Phone number') || error.includes('10 digits'))) setError('');
        if (faceDetectionError) setFaceDetectionError(''); // Clear face detect error on form change
        if (error) setError(''); // Clear general errors
    };

    // --- Webcam Handlers ---

    // **MODIFIED** handleCapture - Includes face detection BEFORE screenshot
    const handleCapture = useCallback(async () => {
        setError('');
        setCameraError(null);
        setFaceDetectionError(''); // Clear previous detection errors

        if (!webcamRef.current || !webcamRef.current.video || !webcamRef.current.video.srcObject) {
             setCameraError("Camera is not ready or not found.");
             return;
         }
        if (!modelsLoaded) {
            setCameraError("Face detection models not loaded yet. Please wait or refresh.");
            return;
        }

        setIsDetecting(true); // Show detecting state
        setPhotoCaptureStage('detecting');

        try {
            const videoElement = webcamRef.current.video;
            // Ensure video is playing and has dimensions before detection
             if (videoElement.paused || videoElement.ended || videoElement.readyState < 3 || videoElement.videoWidth === 0) {
                console.warn("Camera stream not ready for detection. Waiting briefly...");
                // Optional: Add a small delay or retry mechanism if needed, but usually state updates handle this
                 await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
                 if (videoElement.paused || videoElement.ended || videoElement.readyState < 3 || videoElement.videoWidth === 0) {
                    throw new Error("Camera stream failed to initialize properly.");
                 }
             }


            console.log('Running face detection...');
            // Use TinyFaceDetectorOptions for faster detection
            const detectionOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }); // inputSize can be 128, 160, 224, 320, 416, 512, 608. scoreThreshold (0-1) adjusts sensitivity.

            // Detect a single face using the tiny model
            const detections = await faceapi
                .detectSingleFace(videoElement, detectionOptions)
                .withFaceLandmarks(true); // Use tiny landmarks model

            if (detections) {
                console.log('Face detected:', detections.detection.score);
                // Optional: Add more checks - e.g., ensure landmarks are reasonable
                // if (detections.landmarks.positions.length < 68) {
                //     throw new Error("Incomplete face landmarks detected. Please ensure a clear view.")
                // }

                // Face detected, now take the screenshot
                const imageSrc = webcamRef.current.getScreenshot({ width: 640, height: 480 });
                if (!imageSrc) {
                    throw new Error("Failed to capture image after face detection.");
                }
                setCapturedPhoto(imageSrc);
                setPhotoCaptureStage('captured');
                console.log('Photo captured successfully after face detection.');

            } else {
                console.log('No face detected.');
                setFaceDetectionError('No face detected. Please position your face clearly in the camera view and ensure good lighting.');
                setPhotoCaptureStage('capturing'); // Go back to capturing state
            }
        } catch (err) {
            console.error('Error during face detection or capture:', err);
            setCameraError(`Error: ${err.message || "An issue occurred during capture."}`);
            setPhotoCaptureStage('capturing'); // Go back to capturing on error
        } finally {
            setIsDetecting(false); // Hide detecting state
        }
    }, [modelsLoaded]); // Dependency: ensure models are loaded

    const handleRetake = () => {
        setCapturedPhoto(null);
        setError('');
        setCameraError(null);
        setFaceDetectionError('');
        setPhotoCaptureStage('capturing'); // Go back to capturing state
    };

    // --- Profile Submission (Unchanged logic) ---
     const handleProfileSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setCameraError(null);
        setFaceDetectionError(''); // Clear face error on submit attempt

        // Basic form validation
        if (!pendingUserInfo?.email || !formData.name || !formData.phoneNumber || !capturedPhoto) {
            setError('Please fill in Name, Phone Number, and capture a valid photo.');
            return;
        }
        if (!/^\d{10}$/.test(formData.phoneNumber)) {
            setError('Phone number must be exactly 10 digits.');
            return;
        }
        if (photoCaptureStage !== 'captured') {
             setError('Please capture a photo with a detected face first.');
             return;
        }


        setIsLoading(true); // Use general loading state for submission
        setPhotoCaptureStage('submitting');

        try {
            const payload = {
                email: pendingUserInfo.email,
                name: formData.name,
                photo: capturedPhoto,
                phoneNumber: formData.phoneNumber
            };
            console.log("Submitting profile with payload:", { ...payload, photo: 'Base64 present' });
            const res = await api.completeProfile(payload);

            if (res.data.user) {
                console.log("Profile submission successful, setting user:", res.data.user._id);
                setUser(res.data.user); // Update App state
                // Reset local state completely on success
                setPendingUserInfo(null);
                setCapturedPhoto(null);
                setFormData({ name: '', phoneNumber: '' });
                setPhotoCaptureStage('idle');
                setModelsLoaded(false); // Reset model status
            } else {
                throw new Error("User data missing in response from server after profile completion.");
            }

        } catch (err) {
            console.error("Error during profile submission:", err.response?.data || err.message || err);
            const errorMsg = err.response?.data?.message || err.message || 'Failed to save profile. Please try again.';
            setError(errorMsg);
            setPhotoCaptureStage('captured'); // Revert to captured state to allow retry/retake
        } finally {
            setIsLoading(false); // Stop general loading indicator
        }
    };


    // --- Render Logic ---
    return (
        <div className="container signin-page-container">
            <div className="content-center-wrapper">
                {!pendingUserInfo ? (
                    // --- Sign In Card (Google Login) ---
                    <div className="card sign-in-card">
                         <h1 className="title">Welcome to the Library!</h1>
                         <p className="subtitle">Sign in with Google to get started.</p>
                        {isLoadingGoogle ? (
                             <div className="loading-container"><Spinner /><p className="loading-text">Authenticating...</p></div>
                        ) : (
                            <>
                                <p className="sign-in-description">
                                    Access borrowed books, discover new reads, and manage your profile.
                                </p>
                                <div className="button-container">
                                    <GoogleLogin
                                        onSuccess={handleGoogleSuccess}
                                        onError={handleGoogleError}
                                        useOneTap={false} // Disable one-tap for clearer flow
                                        theme="outline"
                                        size="large"
                                        shape="rectangular"
                                    />
                                </div>
                                {error && <p className="error-text sign-in-error">{error}</p>}
                            </>
                        )}
                    </div>
                ) : (
                    // --- Complete Profile Card ---
                    <div className="card profile-completion-card">
                         <h1 className="title">Complete Your Profile</h1>
                         <p className="subtitle">Almost there! We need a few details and a quick photo.</p>
                         <p className="email-text">Email: <span>{pendingUserInfo.email}</span></p>
                         <form onSubmit={handleProfileSubmit} className="form profile-form">
                            {/* --- Name and Phone (Unchanged) --- */}
                            <div className="form-group">
                                <label htmlFor="name">Full Name <span>*</span></label>
                                <input id="name" type="text" name="name" value={formData.name} onChange={handleInputChange} required disabled={isLoading || isDetecting || photoCaptureStage === 'loadingModels'} />
                            </div>
                            <div className="form-group">
                                <label htmlFor="phoneNumber">Phone Number <span>*</span></label>
                                <input id="phoneNumber" type="tel" name="phoneNumber" value={formData.phoneNumber} onChange={handleInputChange} required pattern="\d{10}" maxLength="10" title="Enter exactly 10 digits" disabled={isLoading || isDetecting || photoCaptureStage === 'loadingModels'} />
                                {error && error.includes('10 digits') && <p className="error-text profile-error">{error}</p>}
                            </div>

                            {/* --- Webcam Section (Updated with face-api states) --- */}
                            <div className="form-group webcam-group">
                                <label htmlFor="profilePhoto">User Photo <span>*</span></label>

                                {/* State: Loading Models */}
                                {photoCaptureStage === 'loadingModels' && (
                                    <div className="loading-container validation-loading" style={{padding: '20px 0'}}>
                                        <Spinner />
                                        <p className="loading-text" style={{marginTop: '10px'}}>Loading face detection models...</p>
                                    </div>
                                )}
                                {modelsLoadingError && photoCaptureStage !== 'loadingModels' && (
                                     <p className="error-text camera-error">{modelsLoadingError}</p>
                                )}


                                {/* State: Capturing (Webcam visible, Capture button active) */}
                                {(photoCaptureStage === 'capturing' || photoCaptureStage === 'detecting') && !capturedPhoto && modelsLoaded && (
                                    <div className="webcam-section-signup">
                                        <div className="webcam-container-signup">
                                            <Webcam
                                                audio={false}
                                                ref={webcamRef}
                                                screenshotFormat="image/jpeg"
                                                width={320} // Smaller preview size
                                                height={240}
                                                videoConstraints={{ facingMode: "user", width: 640, height: 480 }} // Request slightly higher resolution
                                                onUserMediaError={(err) => { console.error("Webcam UserMedia Error:", err); setCameraError(`Camera Error: ${err.name}. Please ensure permissions are granted and reload.`); }}
                                                onUserMedia={() => { console.log("Webcam UserMedia Success"); setCameraError(null); }}
                                            />
                                        </div>
                                        {/* Display camera or face detection errors */}
                                        {cameraError && <p className="error-text camera-error">{cameraError}</p>}
                                        {faceDetectionError && <p className="error-text camera-error">{faceDetectionError}</p>}
                                        <button
                                            type="button"
                                            onClick={handleCapture}
                                            className="button primary-button capture-button"
                                            // Disable if error, submitting, actively detecting, or models not loaded
                                            disabled={!!cameraError || isLoading || isDetecting || !modelsLoaded}
                                        >
                                           {isDetecting ? <><Spinner /> Detecting Face...</> : 'Capture Photo'}
                                        </button>
                                        <p className="capture-instruction">
                                            {isDetecting ? 'Hold still...' : 'Please look directly at the camera.'}
                                         </p>
                                    </div>
                                )}

                                {/* State: Captured (Preview visible, Retake button active) */}
                                {photoCaptureStage === 'captured' && capturedPhoto && (
                                    <div className="photo-preview-section">
                                        <img src={capturedPhoto} alt="Captured profile" className="photo-preview-signup" />
                                        <p className="info-text" style={{color: 'var(--success-color)', marginTop: '5px', marginBottom:'10px', fontWeight:500 }}>
                                            ✅ Face detected!
                                         </p>
                                        <button type="button" onClick={handleRetake} className="button secondary-button retake-button" disabled={isLoading}>
                                            Retake Photo
                                        </button>
                                    </div>
                                )}

                                {/* State: Submitting (Show photo, disable buttons) */}
                                 {photoCaptureStage === 'submitting' && capturedPhoto && (
                                    <div className="photo-preview-section">
                                        <img src={capturedPhoto} alt="Captured profile" className="photo-preview-signup" />
                                        {/* Optionally add a submitting indicator near photo */}
                                     </div>
                                 )}

                            </div>

                            {/* General Error Display */}
                            {error && !error.includes('10 digits') && <p className="error-text profile-error">{error}</p>}

                            {/* Submit Button */}
                            <button
                                type="submit"
                                // Disable if: submitting, detecting, no photo, not in 'captured' stage, or models didn't load/had error
                                disabled={isLoading || isDetecting || !capturedPhoto || photoCaptureStage !== 'captured' || !modelsLoaded || !!modelsLoadingError}
                                className="button submit-button complete-profile-submit"
                            >
                                {isLoading && photoCaptureStage === 'submitting' ? <><Spinner/> Saving Profile...</> : 'Save Profile & Continue'}
                            </button>
                        </form>
                    </div>
                )}
            </div>
            {/* REMOVED: Footer from SignIn page */}
            {/* <footer className="signin-footer"><p>© {new Date().getFullYear()} Library Management System</p></footer> */}
        </div>
    );
}