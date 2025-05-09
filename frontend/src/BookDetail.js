// frontend/src/BookDetail.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Webcam from 'react-webcam';
import * as api from './api';
import './styles.css';

const Spinner = () => <div className="spinner"></div>;
const MAX_BORROW_LIMIT = 3;
const REQUIRED_PHOTOS = 4;

export default function BookDetail({ user, onLogout }) {
    const { bookId } = useParams();
    const navigate = useNavigate();
    const webcamRef = useRef(null);
    const [book, setBook] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null); // General page-level errors
    const [showModal, setShowModal] = useState(false);
    const [interactionState, setInteractionState] = useState({
        borrowStatus: 'loading',
        recordId: null,
        borrowCount: 0,
        modalMode: 'borrow', // 'borrow' or 'return'
        processStage: 'capturing', // capturing, reviewing, submitting
        capturedImages: Array(REQUIRED_PHOTOS).fill(null),
        cameraError: null, // Camera-specific errors within the modal
        submitError: null, // Submission-specific errors within the modal
        isSubmitting: false,
    });

    const getBookAndBorrowData = useCallback(async () => {
        if (!bookId || !user?._id) {
            setError("Book ID or User ID missing.");
            setIsLoading(false);
            setInteractionState(prev => ({ ...prev, borrowStatus: 'error' }));
            return;
        }
        setIsLoading(true);
        setError(null); // Clear general page error
        // Reset interaction state for modal/actions but keep user-related info if possible
        setInteractionState(prev => ({
            ...prev, // Keep potentially open modal state? Or reset fully? Let's reset mostly.
            borrowStatus: 'loading',
            recordId: null, // Will be fetched again
            // borrowCount: 0, // Will be fetched again
            modalMode: 'borrow', // Reset mode
            processStage: 'capturing', // Reset stage
            capturedImages: Array(REQUIRED_PHOTOS).fill(null), // Reset images
            cameraError: null, // Clear previous errors
            submitError: null,
            isSubmitting: false
        }));
        try {
            // Fetch book details and borrow status concurrently
            const [bookRes, borrowStatusRes] = await Promise.all([
                api.fetchBookDetails(bookId),
                api.getBorrowStatus(bookId, user._id)
            ]);

            if (!bookRes.data) throw new Error("Book not found.");

            setBook(bookRes.data);
            setInteractionState(prev => ({
                ...prev, // Keep the reset state from above
                borrowStatus: borrowStatusRes.data.status,
                recordId: borrowStatusRes.data.recordId,
                borrowCount: borrowStatusRes.data.borrowCount, // Update with fetched count
            }));
        } catch (err) {
            console.error("Error fetching book/borrow details:", err);
            const errorMsg = err.response?.data?.message || err.message || 'Failed to load book details or borrow status.';
            setError(errorMsg); // Set general page error
            setBook(null); // Clear book data on error
            setInteractionState(prev => ({
                ...prev, // Keep existing state like modalMode if open
                borrowStatus: 'error', // Set status to error
                recordId: null,
                borrowCount: 0, // Reset borrow count on error
            }));
        } finally {
            setIsLoading(false);
        }
    }, [bookId, user?._id]); // Dependencies

    useEffect(() => {
        getBookAndBorrowData();
    }, [getBookAndBorrowData]); // Run effect when function reference changes

    // --- Modal Management ---
    const openModal = (mode) => {
        // Reset modal-specific state when opening
        setInteractionState(prev => ({
            ...prev, // Keep borrowStatus, recordId, borrowCount from page load
            modalMode: mode,
            processStage: 'capturing',
            capturedImages: Array(REQUIRED_PHOTOS).fill(null),
            cameraError: null, // Clear errors specifically for the new modal session
            submitError: null,
            isSubmitting: false,
        }));
        setError(null); // Clear any lingering page-level errors when opening modal
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        // Reset modal state fully on close to ensure clean state next time
         setInteractionState(prev => ({
            ...prev, // Keep borrowStatus, recordId, borrowCount
            modalMode: 'borrow', // Default mode
            processStage: 'capturing',
            capturedImages: Array(REQUIRED_PHOTOS).fill(null),
            cameraError: null,
            submitError: null,
            isSubmitting: false,
        }));
    };

    // --- Webcam and Submission Logic (Borrow/Return Modal) ---
    const handleCapture = useCallback(() => {
        // Clear previous errors *within the modal state*
        setInteractionState(prev => ({ ...prev, cameraError: null, submitError: null }));

        if (!webcamRef.current) {
            setInteractionState(prev => ({ ...prev, cameraError: "Camera component not available." }));
            return;
        }
        const imageSrc = webcamRef.current.getScreenshot({ width: 640, height: 480 });
        if (!imageSrc) {
            // Set camera error within the interactionState
            setInteractionState(prev => ({ ...prev, cameraError: "Failed to capture image." }));
            return;
        }
        const nextEmptyIndex = interactionState.capturedImages.findIndex(img => img === null);
        if (nextEmptyIndex !== -1) {
            const updatedImages = [...interactionState.capturedImages];
            updatedImages[nextEmptyIndex] = imageSrc;
            // Update captured images and clear any camera error
            setInteractionState(prev => ({
                ...prev,
                capturedImages: updatedImages,
                cameraError: null // Clear error on successful capture
             }));
            // Check if all photos are now taken - move to reviewing stage
             if (updatedImages.filter(img => img !== null).length === REQUIRED_PHOTOS) {
                 setInteractionState(prev => ({ ...prev, processStage: 'reviewing' }));
             }
        }
    }, [interactionState.capturedImages]); // Recalculate only if capturedImages change


    const handleRetake = (index) => {
        const updatedImages = [...interactionState.capturedImages];
        updatedImages[index] = null;
        // Go back to capturing stage, clear submission error
        setInteractionState(prev => ({
             ...prev,
             capturedImages: updatedImages,
             processStage: 'capturing', // Go back to capturing
             submitError: null // Clear submit error if user retakes
        }));
    };

    const handleSubmit = async () => {
        const { modalMode, capturedImages, recordId } = interactionState;
        const actionWord = modalMode === 'borrow' ? "Borrow" : "Return";

        // Final checks before submission
        if (capturedImages.some(img => img === null)) {
            setInteractionState(prev => ({ ...prev, submitError: `Please capture all ${REQUIRED_PHOTOS} photos.` }));
            return;
        }
        if (modalMode === 'return' && !recordId) {
            setInteractionState(prev => ({ ...prev, submitError: "Cannot return: Borrowing record ID is missing." }));
            console.error("Attempted return without recordId:", interactionState);
            return;
        }
        if (!user?._id) {
             setInteractionState(prev => ({ ...prev, submitError: "Cannot proceed: User information is missing." }));
             console.error("Attempted submission without userId:", interactionState);
             return;
        }

        setInteractionState(prev => ({ ...prev, processStage: 'submitting', isSubmitting: true, submitError: null }));

        try {
            let response;
            if (modalMode === 'borrow') {
                if (!book?._id) throw new Error("Book ID is missing for borrow operation.");
                response = await api.borrowBook(book._id, { userId: user._id, borrowImages: capturedImages });
                console.log('Borrow successful:', response.data);
            } else { // modalMode === 'return'
                response = await api.returnBook(recordId, { userId: user._id, returnImages: capturedImages });
                console.log('Return successful:', response.data);
            }

            closeModal(); // Close modal on success
            await getBookAndBorrowData(); // Refresh book and borrow status

        } catch (err) {
            console.error(`Error ${actionWord.toLowerCase()}ing book:`, err);
            const errorMsg = err.response?.data?.message || `Failed to ${actionWord.toLowerCase()} the book. ${err.message || ''}`;
            setInteractionState(prev => ({
                ...prev,
                submitError: errorMsg.trim(),
                processStage: 'reviewing', // Go back to review stage on error
                isSubmitting: false
            }));
        }
        // No finally block needed here as isSubmitting is reset on error or success (via closeModal + getBookAndBorrowData)
    };

    // --- Helper Functions ---
    const handleImageError = (e) => {
        e.target.onerror = null;
        e.target.src = 'https://via.placeholder.com/300x450?text=No+Image+Available';
        e.target.classList.add('image-error');
    };

    const handleGoBack = () => navigate(-1); // Navigate back one step in history

    // --- Render Functions ---
    const renderActionButton = () => {
        const { borrowStatus, borrowCount } = interactionState;

        if (borrowStatus === 'loading') {
            return <button className="button action-button primary disabled-visual" disabled>Loading Status...</button>;
        }
        if (borrowStatus === 'error') {
             return <button className="button action-button primary disabled-visual" disabled>Error Loading Status</button>;
        }
        if (borrowStatus === 'borrowedByUser') {
            return <button onClick={() => openModal('return')} className="button action-button secondary return-button">Return Book</button>;
        }
        if (borrowStatus === 'unavailable') {
            return <button className="button action-button primary disabled-visual" disabled>Unavailable</button>;
        }
        if (borrowStatus === 'limitReached') {
            return <button className="button action-button primary disabled-visual" disabled title={`Borrow limit of ${MAX_BORROW_LIMIT} reached.`}>Borrow Limit Reached ({borrowCount}/{MAX_BORROW_LIMIT})</button>;
        }
        // Default is 'canBorrow'
        return <button onClick={() => openModal('borrow')} className="button action-button primary borrow-button">Borrow Book</button>;
    };

    // Renders the content *inside* the modal
    const renderModalContent = () => {
        const { modalMode, processStage, capturedImages, cameraError, submitError, isSubmitting } = interactionState;
        const photosTaken = capturedImages.filter(img => img !== null).length;
        const allPhotosTaken = photosTaken === REQUIRED_PHOTOS;
        const actionWord = modalMode === 'borrow' ? "Borrow" : "Return";
        const actionVerbGerund = modalMode === 'borrow' ? "Borrowing" : "Returning";

        return (
            <div className="modal-overlay" onClick={closeModal}>
                {/* Prevent clicks inside modal from closing it */}
                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                    <div className="modal-header">
                        <h2>{actionVerbGerund} Book: Capture Photos ({photosTaken}/{REQUIRED_PHOTOS})</h2>
                        <button onClick={closeModal} className="modal-close-button" aria-label="Close modal">×</button>
                    </div>

                    <div className="modal-body">
                        {/* Webcam only shown during 'capturing' stage */}
                        {processStage === 'capturing' && (
                            <div className="webcam-section">
                                <div className="webcam-container">
                                    <Webcam
                                        audio={false}
                                        ref={webcamRef}
                                        screenshotFormat="image/jpeg"
                                        width={640}
                                        height={480}
                                        videoConstraints={{ facingMode: "environment", width: 1280, height: 720 }} // Use rear camera if possible
                                        // Update cameraError within interactionState
                                        onUserMediaError={(err) => setInteractionState(prev => ({...prev, cameraError:`Camera Error: ${err.name}. Ensure permissions are granted.`}))}
                                        onUserMedia={() => setInteractionState(prev => ({...prev, cameraError: null}))} // Clear error on success
                                    />
                                     {/* Read cameraError from interactionState */}
                                     {interactionState.cameraError && <p className="error-text camera-error">{interactionState.cameraError}</p>}
                                </div>
                                <button
                                     onClick={handleCapture}
                                     className="button primary-button capture-main-button"
                                     // Disable if submitting, camera error, or all photos taken
                                     disabled={isSubmitting || !!interactionState.cameraError || allPhotosTaken}
                                     aria-label={allPhotosTaken ? "All photos taken" : `Capture photo ${photosTaken + 1} of ${REQUIRED_PHOTOS}`}>
                                   {allPhotosTaken ? `All ${REQUIRED_PHOTOS} Photos Taken` : `Capture Photo`}
                                </button>
                            </div>
                        )}

                        <p className="thumbnail-instruction">
                            {/* Adjust instruction based on stage */}
                            {allPhotosTaken || processStage === 'reviewing' || processStage === 'submitting'
                                ? `Review photos before confirming ${actionVerbGerund.toLowerCase()}.`
                                : `Requires ${REQUIRED_PHOTOS} photos. Capture ${REQUIRED_PHOTOS - photosTaken} more.`}
                        </p>

                        {/* Thumbnails always visible after capturing starts */}
                         <div className="image-thumbnails-grid">
                            {capturedImages.map((imgSrc, index) => (
                                <div key={index} className="thumbnail-slot">
                                    <p>Photo {index + 1}</p>
                                    {imgSrc ? (
                                        <img src={imgSrc} alt={`Preview ${index + 1}`} className="thumbnail-preview" />
                                     ) : (
                                         <div className="thumbnail-placeholder">Empty</div>
                                     )}
                                    {/* Show retake button only if image exists and not submitting */}
                                    {imgSrc && processStage !== 'submitting' && (
                                        <button onClick={() => handleRetake(index)} className="button tertiary-button retake-button" disabled={isSubmitting} aria-label={`Retake photo ${index + 1}`}>Retake</button>
                                    )}
                                </div>
                            ))}
                        </div>

                         {/* Show submission error if present */}
                         {submitError && <p className="error-text submit-error">{submitError}</p>}
                     </div>

                     {/* Modal Footer Actions */}
                     <div className="modal-footer">
                         {/* Show Cancel button if capturing and not all photos taken */}
                         {processStage === 'capturing' && !allPhotosTaken && (
                             <button onClick={closeModal} className="button secondary-button">Cancel</button>
                         )}
                         {/* Button to proceed to review (now happens automatically) - kept for explicit action */}
                         {/* {processStage === 'capturing' && allPhotosTaken && (
                             <>
                                <button onClick={() => setInteractionState(prev => ({...prev, processStage:'reviewing'}))} className="button primary-button">Review & Confirm</button>
                                <button onClick={closeModal} className="button secondary-button">Cancel</button>
                             </>
                         )} */}
                         {/* Show Confirm/Back if reviewing */}
                         {processStage === 'reviewing' && (
                             <>
                                <button onClick={handleSubmit} className="button primary-button submit-final-button" disabled={isSubmitting || !allPhotosTaken}>
                                    {isSubmitting ? <Spinner /> : `Confirm ${actionWord}`}
                                </button>
                                {/* Allow going back to capture even after auto-advancing */}
                                <button onClick={() => setInteractionState(prev => ({...prev, processStage:'capturing'}))} className="button secondary-button" disabled={isSubmitting}>Back to Capture</button>
                             </>
                         )}
                          {/* Show only spinner if submitting */}
                         {processStage === 'submitting' && (
                            <div style={{width: '100%', display: 'flex', justifyContent: 'center'}}>
                                <Spinner />
                            </div>
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
                <header className="book-detail-header">
                     {/* Back button always visible */}
                    <button onClick={handleGoBack} className="button back-button"><span role="img" aria-label="Back arrow">⬅️</span> Back</button>

                    {/* User-specific actions only if logged in */}
                    {user && (
                        <div className="header-user-info">
                             {/* Link to My Borrows */}
                             <Link to="/my-borrows" className="button secondary-button header-nav-button" style={{marginRight: '15px'}}>My Borrows</Link>
                             {/* Logout button */}
                             <button onClick={onLogout} className="button logout-button header-logout">Log Out</button>
                        </div>
                    )}
                </header>

                <main className="book-detail-main-content">
                    {/* Loading State */}
                    {isLoading && !book && (
                         <div className="loading-container"><Spinner /><p>Loading book details...</p></div>
                    )}
                    {/* Error State */}
                    {error && !isLoading && (
                        <div className="error-container">
                            <p className="error-text">{error}</p>
                            <button onClick={handleGoBack} className="button secondary-button">Go Back</button>
                            {/* Optionally add a retry button */}
                            <button onClick={getBookAndBorrowData} className="button primary-button" style={{marginLeft: '10px'}}>Retry</button>
                        </div>
                    )}
                    {/* Content State */}
                    {!isLoading && !error && book && (
                         <div className="book-detail-content-wrapper">
                            {/* Left Column: Cover and Actions */}
                            <div className="book-detail-cover-column">
                                <div className="book-detail-cover-container">
                                    <img
                                        src={book.image || 'https://via.placeholder.com/300x450?text=No+Image+Available'}
                                        alt={`${book.title} cover`}
                                        className="book-detail-cover"
                                        onError={handleImageError}
                                        loading="lazy" // Lazy load image
                                    />
                                </div>
                                <div className="book-detail-actions below-cover">
                                    {renderActionButton()}
                                    {/* REMOVED: Borrow count display under the Borrow button */}
                                    {/* {interactionState.borrowStatus !== 'loading' && interactionState.borrowStatus !== 'error' && interactionState.borrowStatus !== 'borrowedByUser' && (
                                        <p className="borrow-limit-info">
                                            {interactionState.borrowCount} / {MAX_BORROW_LIMIT} books currently borrowed.
                                        </p>
                                     )} */}
                                </div>
                            </div>

                             {/* Right Column: Book Info */}
                             <div className="book-detail-info-container">
                                <h1 className="book-detail-title">{book.title}</h1>
                                <p className="book-detail-author">by {book.author}</p>
                                {book.bookid && (<p className="book-detail-bookid"><span className="bookid-label">Book ID:</span> {book.bookid}</p>)}
                                <div className="book-detail-meta">
                                    {book.genre && <span className="book-detail-genre-tag">{book.genre}</span>}
                                    <span className={`book-detail-availability ${book.availableCopies > 0 && interactionState.borrowStatus !== 'borrowedByUser' ? 'available' : 'unavailable'}`}>
                                        {interactionState.borrowStatus === 'borrowedByUser'
                                            ? `✅ Borrowed by You`
                                            : book.availableCopies > 0
                                                ? `✅ ${book.availableCopies} available`
                                                : `❌ Unavailable`}
                                    </span>
                                    {/* Display total copies if needed */}
                                    {/* <span className="total-copies">({book.copies} total)</span> */}
                                </div>
                                <div className="book-detail-about">
                                    <h2>About this book</h2>
                                    <p className="about-text">{book.about || 'No description available.'}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
                 {/* Footer */}
                 <footer className="home-footer"><p>© {new Date().getFullYear()} Library Management System</p></footer>
            </div>

            {/* Render the modal conditionally */}
            {showModal && renderModalContent()}
        </>
    );
}