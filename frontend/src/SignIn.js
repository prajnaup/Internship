// frontend/src/SignIn.js
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import Webcam from 'react-webcam';
import jwtDecode from 'jwt-decode';
import * as faceapi from 'face-api.js';
import * as api from './api';
import './styles.css';
import { useNavigate } from 'react-router-dom'; // Import useNavigate

const Spinner = () => <div className="spinner"></div>;

export default function SignIn({ setUser }) {
    const [pendingUserInfo, setPendingUserInfo] = useState(null);
    const [formData, setFormData] = useState({ name: '', phoneNumber: '' });
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);

    const webcamRef = useRef(null);
    const [capturedPhoto, setCapturedPhoto] = useState(null);
    const [cameraError, setCameraError] = useState(null);

    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [modelsLoadingError, setModelsLoadingError] = useState(null);
    const [isDetecting, setIsDetecting] = useState(false);
    const [faceDetectionError, setFaceDetectionError] = useState('');
    const [photoCaptureStage, setPhotoCaptureStage] = useState('idle');

    const navigate = useNavigate(); // Initialize useNavigate

    useEffect(() => {
        if (pendingUserInfo && !modelsLoaded && photoCaptureStage !== 'loadingModels' && !modelsLoadingError) {
            const loadModels = async () => {
                // ... (model loading logic - no changes here)
                const MODEL_URL = '/models'; 
                setPhotoCaptureStage('loadingModels');
                setModelsLoadingError(null);
                console.log('Loading face-api models...');
                try {
                    await faceapi.tf.ready();
                    console.log('TensorFlow backend ready.');

                    await Promise.all([
                        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                        faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
                    ]);
                    console.log('Face-api models loaded successfully.');
                    setModelsLoaded(true);
                    setPhotoCaptureStage('capturing');
                } catch (err) {
                    console.error('Error loading face-api models:', err);
                    setModelsLoadingError('Could not load face detection models. Please try refreshing the page.');
                    setPhotoCaptureStage('idle');
                }
            };
            loadModels();
        }
    }, [pendingUserInfo, modelsLoaded, photoCaptureStage, modelsLoadingError]);

    const handleGoogleSuccess = async (credentialResponse) => {
        setError('');
        setIsLoadingGoogle(true);
        // ... (reset other states - no changes here)
        setPendingUserInfo(null);
        setCapturedPhoto(null);
        setPhotoCaptureStage('idle'); 
        setCameraError(null);
        setModelsLoaded(false); 
        setModelsLoadingError(null);
        setFaceDetectionError('');

        try {
            const decoded = jwtDecode(credentialResponse.credential);
            const { email, name } = decoded;

            if (!email) throw new Error("Failed to get email from Google.");

            const res = await api.googleLoginCheck({ email, name });

            if (res.data.needsCompletion === false && res.data.user) {
                // User exists, role and isBlocked should be in res.data.user
                setUser(res.data.user); // This will trigger App.js useEffect and navigation
                // Redirect based on role
                if (res.data.user.role === 'admin') {
                    navigate('/admin/dashboard', { state: { message: 'Admin login successful.', messageType: 'success' } });
                } else {
                    navigate('/'); // Regular users to home
                }
            } else if (res.data.needsCompletion === true) {
                setPendingUserInfo({ email: res.data.email });
                setFormData({ name: res.data.suggestedName || '', phoneNumber: '' });
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
        // ... (no changes here)
        console.log('Google Login Failed');
        setError('Google Sign-In failed. Please try again.');
        setPendingUserInfo(null);
        setIsLoadingGoogle(false);
        setPhotoCaptureStage('idle');
    };

     const handleInputChange = (e) => {
        // ... (no changes here)
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (name === 'phoneNumber' && (error.includes('Phone number') || error.includes('10 digits'))) setError('');
        if (faceDetectionError) setFaceDetectionError(''); 
        if (error) setError(''); 
    };

    const handleCapture = useCallback(async () => {
        // ... (face detection and capture logic - no changes here)
         setError('');
        setCameraError(null);
        setFaceDetectionError(''); 

        if (!webcamRef.current || !webcamRef.current.video || !webcamRef.current.video.srcObject) {
             setCameraError("Camera is not ready or not found.");
             return;
         }
        if (!modelsLoaded) {
            setCameraError("Face detection models not loaded yet. Please wait or refresh.");
            return;
        }
        setIsDetecting(true);
        setPhotoCaptureStage('detecting');
        try {
            const videoElement = webcamRef.current.video;
             if (videoElement.paused || videoElement.ended || videoElement.readyState < 3 || videoElement.videoWidth === 0) {
                 await new Promise(resolve => setTimeout(resolve, 100));
                 if (videoElement.paused || videoElement.ended || videoElement.readyState < 3 || videoElement.videoWidth === 0) {
                    throw new Error("Camera stream failed to initialize properly.");
                 }
             }
            const detectionOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
            const detections = await faceapi
                .detectSingleFace(videoElement, detectionOptions)
                .withFaceLandmarks(true); 

            if (detections) {
                const imageSrc = webcamRef.current.getScreenshot({ width: 640, height: 480 });
                if (!imageSrc) {
                    throw new Error("Failed to capture image after face detection.");
                }
                setCapturedPhoto(imageSrc);
                setPhotoCaptureStage('captured');
            } else {
                setFaceDetectionError('No face detected. Please position your face clearly in the camera view and ensure good lighting.');
                setPhotoCaptureStage('capturing');
            }
        } catch (err) {
            console.error('Error during face detection or capture:', err);
            setCameraError(`Error: ${err.message || "An issue occurred during capture."}`);
            setPhotoCaptureStage('capturing'); 
        } finally {
            setIsDetecting(false);
        }
    }, [modelsLoaded]);

    const handleRetake = () => {
        // ... (no changes here)
        setCapturedPhoto(null);
        setError('');
        setCameraError(null);
        setFaceDetectionError('');
        setPhotoCaptureStage('capturing');
    };

     const handleProfileSubmit = async (e) => {
        // ... (profile submission logic - no changes here, setUser will handle role)
        e.preventDefault();
        setError('');
        setCameraError(null);
        setFaceDetectionError('');

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
        setIsLoading(true);
        setPhotoCaptureStage('submitting');
        try {
            const payload = {
                email: pendingUserInfo.email,
                name: formData.name,
                photo: capturedPhoto,
                phoneNumber: formData.phoneNumber
            };
            const res = await api.completeProfile(payload);
            if (res.data.user) {
                // User object from backend now includes role and isBlocked
                setUser(res.data.user); // This will trigger App.js useEffect and navigation
                // Newly completed profile users are always 'user' role, so redirect to home
                navigate('/');
            } else {
                throw new Error("User data missing in response from server after profile completion.");
            }
        } catch (err) {
            console.error("Error during profile submission:", err.response?.data || err.message || err);
            const errorMsg = err.response?.data?.message || err.message || 'Failed to save profile. Please try again.';
            setError(errorMsg);
            setPhotoCaptureStage('captured');
        } finally {
            setIsLoading(false);
        }
    };

    // --- Render Logic (no changes here) ---
    return (
        <div className="container signin-page-container">
            {/* ... existing JSX ... */}
            <div className="content-center-wrapper">
                {!pendingUserInfo ? (
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
                                        useOneTap={false}
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
                    <div className="card profile-completion-card">
                         <h1 className="title">Complete Your Profile</h1>
                         <p className="subtitle">Almost there! We need a few details and a quick photo.</p>
                         <p className="email-text">Email: <span>{pendingUserInfo.email}</span></p>
                         <form onSubmit={handleProfileSubmit} className="form profile-form">
                            <div className="form-group">
                                <label htmlFor="name">Full Name <span>*</span></label>
                                <input id="name" type="text" name="name" value={formData.name} onChange={handleInputChange} required disabled={isLoading || isDetecting || photoCaptureStage === 'loadingModels'} />
                            </div>
                            <div className="form-group">
                                <label htmlFor="phoneNumber">Phone Number <span>*</span></label>
                                <input id="phoneNumber" type="tel" name="phoneNumber" value={formData.phoneNumber} onChange={handleInputChange} required pattern="\d{10}" maxLength="10" title="Enter exactly 10 digits" disabled={isLoading || isDetecting || photoCaptureStage === 'loadingModels'} />
                                {error && error.includes('10 digits') && <p className="error-text profile-error">{error}</p>}
                            </div>
                            <div className="form-group webcam-group">
                                <label htmlFor="profilePhoto">User Photo <span>*</span></label>
                                {photoCaptureStage === 'loadingModels' && (
                                    <div className="loading-container validation-loading" style={{padding: '20px 0'}}>
                                        <Spinner />
                                        <p className="loading-text" style={{marginTop: '10px'}}>Loading face detection models...</p>
                                    </div>
                                )}
                                {modelsLoadingError && photoCaptureStage !== 'loadingModels' && (
                                     <p className="error-text camera-error">{modelsLoadingError}</p>
                                )}
                                {(photoCaptureStage === 'capturing' || photoCaptureStage === 'detecting') && !capturedPhoto && modelsLoaded && (
                                    <div className="webcam-section-signup">
                                        <div className="webcam-container-signup">
                                            <Webcam
                                                audio={false}
                                                ref={webcamRef}
                                                screenshotFormat="image/jpeg"
                                                width={320} 
                                                height={240}
                                                videoConstraints={{ facingMode: "user", width: 640, height: 480 }}
                                                onUserMediaError={(err) => { console.error("Webcam UserMedia Error:", err); setCameraError(`Camera Error: ${err.name}. Please ensure permissions are granted and reload.`); }}
                                                onUserMedia={() => { console.log("Webcam UserMedia Success"); setCameraError(null); }}
                                            />
                                        </div>
                                        {cameraError && <p className="error-text camera-error">{cameraError}</p>}
                                        {faceDetectionError && <p className="error-text camera-error">{faceDetectionError}</p>}
                                        <button
                                            type="button"
                                            onClick={handleCapture}
                                            className="button primary-button capture-button"
                                            disabled={!!cameraError || isLoading || isDetecting || !modelsLoaded}
                                        >
                                           {isDetecting ? <><Spinner /> Detecting Face...</> : 'Capture Photo'}
                                        </button>
                                        <p className="capture-instruction">
                                            {isDetecting ? 'Hold still...' : 'Please look directly at the camera.'}
                                         </p>
                                    </div>
                                )}
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
                                 {photoCaptureStage === 'submitting' && capturedPhoto && (
                                    <div className="photo-preview-section">
                                        <img src={capturedPhoto} alt="Captured profile" className="photo-preview-signup" />
                                     </div>
                                 )}
                            </div>
                            {error && !error.includes('10 digits') && <p className="error-text profile-error">{error}</p>}
                            <button
                                type="submit"
                                disabled={isLoading || isDetecting || !capturedPhoto || photoCaptureStage !== 'captured' || !modelsLoaded || !!modelsLoadingError}
                                className="button submit-button complete-profile-submit"
                            >
                                {isLoading && photoCaptureStage === 'submitting' ? <><Spinner/> Saving Profile...</> : 'Save Profile & Continue'}
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}