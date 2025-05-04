// frontend/src/BookDetail.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom'; // Import Link
import Webcam from 'react-webcam';
import * as api from './api';
import './styles.css';

// Shared Spinner component
const Spinner = () => <div className="spinner"></div>;

// Constants
const MAX_BORROW_LIMIT = 3;
const REQUIRED_PHOTOS = 4;

export default function BookDetail({ user, onLogout }) { // Receive onLogout
    const { bookId } = useParams();
    const navigate = useNavigate();
    const webcamRef = useRef(null);

    const [book, setBook] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showModal, setShowModal] = useState(false);

    // Consolidated state for borrowing/returning status and modal interaction
    const [interactionState, setInteractionState] = useState({
        borrowStatus: 'loading', // loading, canBorrow, borrowedByUser, unavailable, limitReached
        recordId: null,          // ID of the active borrow record if borrowedByUser
        borrowCount: 0,          // User's current borrow count
        modalMode: 'borrow',     // 'borrow' or 'return'
        processStage: 'capturing',// capturing, reviewing, submitting
        capturedImages: Array(REQUIRED_PHOTOS).fill(null),
        cameraError: null,
        submitError: null,
        isSubmitting: false,
    });

    // --- Data Fetching ---
    const getBookAndBorrowData = useCallback(async () => {
        if (!bookId || !user?._id) {
            setError("Book ID or User ID missing.");
            setIsLoading(false);
            setInteractionState(prev => ({ ...prev, borrowStatus: 'error' }));
            return;
        }

        setIsLoading(true);
        setError(null);
        setInteractionState(prev => ({ ...prev, borrowStatus: 'loading' })); // Indicate status check loading

        try {
            // Fetch book details and borrow status concurrently
            const [bookRes, borrowStatusRes] = await Promise.all([
                api.fetchBookDetails(bookId),
                api.getBorrowStatus(bookId, user._id)
            ]);

            if (!bookRes.data) {
                 throw new Error("Book not found.");
            }

            setBook(bookRes.data);
            setInteractionState(prev => ({ // Update borrow status based on API response
                ...prev,
                borrowStatus: borrowStatusRes.data.status,
                recordId: borrowStatusRes.data.recordId,
                borrowCount: borrowStatusRes.data.borrowCount,
            }));
        } catch (err) {
            console.error("Error fetching book/borrow details:", err);
            const errorMsg = err.response?.data?.message || err.message || 'Failed to load book details or borrow status.';
            setError(errorMsg);
            setBook(null); // Clear book data on error
            setInteractionState(prev => ({
                ...prev,
                borrowStatus: 'error', // Indicate an error occurred
                recordId: null,
                borrowCount: 0,
            }));
        } finally {
            setIsLoading(false);
        }
    }, [bookId, user?._id]); // Dependencies for useCallback

    useEffect(() => {
        getBookAndBorrowData();
    }, [getBookAndBorrowData]); // Run effect when the function identity changes

    // --- Modal Control ---
    const openModal = (mode) => {
        console.log(`Opening modal for ${mode}`);
        setInteractionState(prev => ({
            ...prev,
            modalMode: mode,
            processStage: 'capturing',
            capturedImages: Array(REQUIRED_PHOTOS).fill(null),
            cameraError: null,
            submitError: null,
            isSubmitting: false,
        }));
        setShowModal(true);
    };

    const closeModal = () => {
        console.log("Closing modal");
        setShowModal(false);
        // Reset modal-specific state to defaults, but keep borrowStatus, recordId, borrowCount
        setInteractionState(prev => ({
            ...prev,
            modalMode: 'borrow', // Default back to borrow
            processStage: 'capturing',
            capturedImages: Array(REQUIRED_PHOTOS).fill(null),
            cameraError: null,
            submitError: null,
            isSubmitting: false,
        }));
    };

    // --- Image Handling ---
    const handleCapture = useCallback(() => {
        if (!webcamRef.current) {
            setInteractionState(prev => ({ ...prev, cameraError: "Camera component not available." }));
            return;
        }
        const imageSrc = webcamRef.current.getScreenshot({ width: 640, height: 480 });
        if (!imageSrc) {
            setInteractionState(prev => ({ ...prev, cameraError: "Failed to capture image. Webcam might not be ready or permissions denied." }));
            return;
        }

        const nextEmptyIndex = interactionState.capturedImages.findIndex(img => img === null);
        if (nextEmptyIndex !== -1) {
            const updatedImages = [...interactionState.capturedImages];
            updatedImages[nextEmptyIndex] = imageSrc;
            setInteractionState(prev => ({
                ...prev,
                capturedImages: updatedImages,
                cameraError: null // Clear error on success
            }));
            console.log(`Captured photo ${nextEmptyIndex + 1}`);
        } else {
            console.log("All photo slots are full."); // Should ideally not happen if button is disabled
        }
    }, [interactionState.capturedImages]); // Dependency

    const handleRetake = (index) => {
        console.log(`Clearing photo slot ${index + 1} for retake.`);
        const updatedImages = [...interactionState.capturedImages];
        updatedImages[index] = null;
        setInteractionState(prev => ({
            ...prev,
            capturedImages: updatedImages,
            processStage: 'capturing', // Go back to capturing stage
            submitError: null          // Clear any previous submission error
        }));
    };

    // --- Submission ---
    const handleSubmit = async () => {
        const { modalMode, capturedImages, recordId } = interactionState;
        const actionWord = modalMode === 'borrow' ? "Borrow" : "Return";

        if (capturedImages.some(img => img === null)) {
            setInteractionState(prev => ({ ...prev, submitError: `Please capture all ${REQUIRED_PHOTOS} photos.` }));
            return;
        }
        if (modalMode === 'return' && !recordId) {
            setInteractionState(prev => ({ ...prev, submitError: "Cannot return: Borrowing record ID is missing." }));
             console.error("Return attempt failed: recordId is null", interactionState);
            return;
        }

        setInteractionState(prev => ({
            ...prev,
            processStage: 'submitting',
            isSubmitting: true,
            submitError: null
        }));
        console.log(`Submitting ${actionWord} request...`);

        try {
            if (modalMode === 'borrow') {
                if (!book?._id) throw new Error("Book ID is missing for borrow.");
                const payload = { userId: user._id, borrowImages: capturedImages };
                await api.borrowBook(book._id, payload);
            } else { // Return
                const payload = { userId: user._id, returnImages: capturedImages };
                await api.returnBook(recordId, payload);
            }
            console.log(`${actionWord} successful!`);
            closeModal(); // Close modal on success
            await getBookAndBorrowData(); // Refresh book/borrow status
        } catch (err) {
            console.error(`Error submitting ${actionWord}:`, err);
            const errorMsg = err.response?.data?.message || `Failed to ${actionWord.toLowerCase()} the book. ${err.message || ''}`;
            setInteractionState(prev => ({
                ...prev,
                submitError: errorMsg.trim(),
                processStage: 'reviewing', // Allow user to retry or go back
                isSubmitting: false
            }));
        }
        // No need to set isSubmitting false on success, as modal closes
    };

    // --- UI Rendering Helpers ---
    const handleImageError = (e) => {
        e.target.onerror = null;
        e.target.src = 'https://via.placeholder.com/300x450?text=No+Image+Available';
        e.target.classList.add('image-error');
    };

    const handleGoBack = () => {
        navigate(-1); // Go back to the previous page in history
    };

    const renderActionButton = () => {
        const { borrowStatus, isSubmitting } = interactionState;

        if (borrowStatus === 'loading') {
            return <button className="button action-button primary disabled-visual" disabled>Loading Status...</button>;
        }
        if (borrowStatus === 'borrowedByUser') {
            // Open modal in 'return' mode
            return <button onClick={() => openModal('return')} className="button action-button secondary return-button">Return Book</button>;
        }
        if (borrowStatus === 'unavailable') {
            return <button className="button action-button primary disabled-visual" disabled>Unavailable</button>;
        }
        if (borrowStatus === 'limitReached') {
            return <button className="button action-button primary disabled-visual" disabled title={`Borrow limit of ${MAX_BORROW_LIMIT} reached.`}>Borrow Limit Reached</button>;
        }
        if (borrowStatus === 'canBorrow') {
             // Open modal in 'borrow' mode
            return <button onClick={() => openModal('borrow')} className="button action-button primary borrow-button">Borrow Book</button>;
        }
         if (borrowStatus === 'error') {
             return <button className="button action-button primary disabled-visual" disabled>Error Loading Status</button>;
         }
        // Default/fallback (should ideally not be reached)
        return <button className="button action-button primary disabled-visual" disabled>...</button>;
    };

    // --- Modal Content ---
    const renderModalContent = () => {
        const {
            modalMode, processStage, capturedImages, cameraError,
            submitError, isSubmitting
        } = interactionState;

        const photosTaken = capturedImages.filter(img => img !== null).length;
        const allPhotosTaken = photosTaken === REQUIRED_PHOTOS;
        const actionWord = modalMode === 'borrow' ? "Borrow" : "Return";
        const actionVerbGerund = modalMode === 'borrow' ? "Borrowing" : "Returning";

        return (
            <div className="modal-overlay" onClick={closeModal}>
                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                    <div className="modal-header">
                        <h2>{actionVerbGerund} Book: Capture Photos ({photosTaken}/{REQUIRED_PHOTOS})</h2>
                        <button onClick={closeModal} className="modal-close-button" aria-label="Close modal">×</button>
                    </div>

                    <div className="modal-body">
                        {processStage === 'capturing' && (
                            <div className="webcam-section">
                                <div className="webcam-container">
                                    <Webcam
                                        audio={false}
                                        ref={webcamRef}
                                        screenshotFormat="image/jpeg"
                                        width={640} height={480}
                                        videoConstraints={{ facingMode: "environment", width: 1280, height: 720 }} // Request higher res if possible
                                         onUserMediaError={(err) => {
                                             console.error("Webcam error:", err);
                                             setInteractionState(prev => ({...prev, cameraError:`Camera Error: ${err.name}. Ensure permissions are granted.`}));
                                         }}
                                         onUserMedia={() => setInteractionState(prev => ({...prev, cameraError: null}))} // Clear error on success
                                    />
                                    {cameraError && <p className="error-text camera-error">{cameraError}</p>}
                                </div>
                                {/* Capture button moved below webcam */}
                                <button
                                    onClick={handleCapture}
                                    className="button primary-button capture-main-button"
                                    disabled={isSubmitting || !!cameraError || allPhotosTaken}
                                    aria-label={allPhotosTaken ? "All photos taken" : `Capture photo ${photosTaken + 1} of ${REQUIRED_PHOTOS}`}
                                >
                                   {allPhotosTaken ? "All Photos Taken" : `Capture Photo ${photosTaken + 1}`}
                                </button>
                            </div>
                        )}

                        <p className="thumbnail-instruction">
                           {allPhotosTaken || processStage === 'reviewing' ? 'Review photos before confirming.' : `Requires ${REQUIRED_PHOTOS} photos for ${actionVerbGerund.toLowerCase()}.`}
                        </p>
                        <div className="image-thumbnails-grid">
                            {capturedImages.map((imgSrc, index) => (
                                <div key={index} className="thumbnail-slot">
                                    <p>Photo {index + 1}</p>
                                    {imgSrc ? (
                                        <img src={imgSrc} alt={`Preview ${index + 1}`} className="thumbnail-preview" />
                                    ) : (
                                        <div className="thumbnail-placeholder">Empty Slot</div>
                                    )}
                                    {/* Show retake button only if image exists and not submitting */}
                                    {imgSrc && processStage !== 'submitting' && (
                                        <button
                                            onClick={() => handleRetake(index)}
                                            className="button tertiary-button retake-button"
                                            disabled={isSubmitting}
                                            aria-label={`Retake photo ${index + 1}`}
                                            >
                                            Retake
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                         {submitError && <p className="error-text submit-error">{submitError}</p>}
                     </div>

                     {/* Modal Footer Actions */}
                     <div className="modal-footer">
                         {processStage === 'capturing' && !allPhotosTaken && (
                             <button onClick={closeModal} className="button secondary-button">Cancel</button>
                         )}
                         {processStage === 'capturing' && allPhotosTaken && (
                             <>
                                <button onClick={() => setInteractionState(prev => ({...prev, processStage:'reviewing'}))} className="button primary-button">
                                    Review & Confirm
                                </button>
                                <button onClick={closeModal} className="button secondary-button">Cancel</button>
                             </>
                         )}
                         {processStage === 'reviewing' && (
                             <>
                                <button onClick={handleSubmit} className="button primary-button submit-final-button" disabled={isSubmitting || !allPhotosTaken}>
                                   {isSubmitting ? <Spinner /> : `Confirm ${actionWord}`}
                                </button>
                                <button onClick={() => setInteractionState(prev => ({...prev, processStage:'capturing'}))} className="button secondary-button" disabled={isSubmitting}>
                                    Back to Capture
                                </button>
                             </>
                         )}
                         {processStage === 'submitting' && (
                              <Spinner /> // Show only spinner during submission
                          )}
                     </div>
                </div>
            </div>
        );
    };

    // --- Main Component Render ---
    return (
        <>
            <div className="book-detail-page">
                {/* Header with Back Button and User Info/Logout */}
                <header className="book-detail-header">
                    <button onClick={handleGoBack} className="button back-button">
                        <span role="img" aria-label="Back arrow">⬅️</span> Back
                    </button>
                    {user && (
                        <div className="header-user-info">
                             {/* Link to My Borrows */}
                             <Link to="/my-borrows" className="button secondary-button header-nav-button" style={{marginRight: '15px'}}>My Borrows</Link>

                            <span>{user.name}</span>
                            {user.photo ? (
                                <img src={user.photo} alt="" className="header-avatar-small" /> // Alt left empty for decorative avatar
                            ) : (
                                <div className="header-avatar-placeholder header-avatar-small">{user.name ? user.name.charAt(0).toUpperCase() : '?'}</div>
                            )}
                            <button onClick={onLogout} className="button logout-button header-logout">Log Out</button>
                        </div>
                    )}
                </header>

                <main className="book-detail-main-content">
                    {isLoading && !book && (
                        <div className="loading-container"><Spinner /><p>Loading book details...</p></div>
                    )}
                    {error && !isLoading && (
                        <div className="error-container">
                            <p className="error-text">{error}</p>
                            <button onClick={handleGoBack} className="button secondary-button">Go Back</button>
                        </div>
                    )}

                    {!isLoading && !error && book && (
                         <div className="book-detail-content-wrapper">
                            {/* Left Column: Cover & Action Button */}
                            <div className="book-detail-cover-column">
                                <div className="book-detail-cover-container">
                                    <img
                                        src={book.image || 'https://via.placeholder.com/300x450?text=No+Image+Available'}
                                        alt={`${book.title} cover`}
                                        className="book-detail-cover"
                                        onError={handleImageError}
                                        loading="lazy"
                                    />
                                </div>
                                <div className="book-detail-actions below-cover">
                                    {renderActionButton()}
                                </div>
                            </div>

                             {/* Right Column: Book Info */}
                             <div className="book-detail-info-container">
                                <h1 className="book-detail-title">{book.title}</h1>
                                <p className="book-detail-author">by {book.author}</p>
                                <div className="book-detail-meta">
                                    {book.genre && <span className="book-detail-genre-tag">{book.genre}</span>}
                                    {/* Updated Availability Display */}
                                    <span className={`book-detail-availability ${book.availableCopies > 0 ? 'available' : 'unavailable'}`}>
                                        {interactionState.borrowStatus === 'borrowedByUser'
                                            ? `✅ Borrowed by You`
                                            : book.availableCopies > 0
                                                ? `✅ ${book.availableCopies} available`
                                                : `❌ Unavailable`
                                        }
                                        <span className="total-copies"> / {book.copies ?? 'N/A'} total</span>
                                    </span>
                                    {/* Display borrow count */}
                                    <span className="borrow-limit-info">
                                        ({interactionState.borrowCount}/{MAX_BORROW_LIMIT} books borrowed)
                                    </span>
                                </div>
                                <div className="book-detail-about">
                                    <h2>About this book</h2>
                                    <p className="about-text">{book.about || 'No description available.'}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
                 <footer className="home-footer">
                    <p>© {new Date().getFullYear()} Library Management System</p>
                </footer>
            </div>

            {/* Modal Rendering (conditionally rendered) */}
            {showModal && renderModalContent()}
        </>
    );
}