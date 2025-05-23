// frontend/src/MyBorrows.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom'; // Removed useNavigate as it wasn't used
import Webcam from 'react-webcam';
import * as api from './api';
import './styles.css'; // Reuse global styles

// Shared Components
const Spinner = () => <div className="spinner"></div>;
const REQUIRED_PHOTOS = 4;
const MAX_BORROW_LIMIT = 3;

// Helper function to format dates
const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric'
        });
    } catch (e) {
        return 'Invalid Date';
    }
};

export default function MyBorrows({ user, onLogout }) {
    const [borrowedRecords, setBorrowedRecords] = useState([]);
    const [historicalRecords, setHistoricalRecords] = useState([]); // <-- State for history
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    // const navigate = useNavigate(); // Removed as it wasn't used

    // --- State for the Return Modal ---
    const [showReturnModal, setShowReturnModal] = useState(false);
    const [currentRecordForReturn, setCurrentRecordForReturn] = useState(null);
    const [returnInteractionState, setReturnInteractionState] = useState({
        processStage: 'capturing',// capturing, reviewing, submitting
        capturedImages: Array(REQUIRED_PHOTOS).fill(null),
        cameraError: null,
        submitError: null,
        isSubmitting: false,
    });
    const returnWebcamRef = useRef(null);

    // --- Fetch Borrowed Records and History ---
    const loadData = useCallback(async () => {
        if (!user?._id) {
            setError("User not identified. Please log in again.");
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        setBorrowedRecords([]); // Clear previous data
        setHistoricalRecords([]); // Clear previous data
        try {
            // Fetch both active and historical records concurrently
            const [activeRes, historyRes] = await Promise.all([
                api.fetchMyBorrows(user._id),
                api.fetchMyHistory(user._id) // New API call
            ]);

            // Process active borrows
            console.log("Fetched active records:", activeRes.data?.length);
            const sortedActiveData = (activeRes.data || []).sort((a, b) => new Date(a.returnDate) - new Date(b.returnDate));
            setBorrowedRecords(sortedActiveData);

            // Process historical borrows
            console.log("Fetched historical records:", historyRes.data?.length);
            // Already sorted by backend (actualReturnDate desc)
            setHistoricalRecords(historyRes.data || []);

        } catch (err) {
            console.error("Error fetching borrowed books/history:", err);
            setError(err.response?.data?.message || "Failed to load borrowed books or history.");
            setBorrowedRecords([]); // Ensure clear on error
            setHistoricalRecords([]); // Ensure clear on error
        } finally {
            setIsLoading(false);
        }
    }, [user?._id]);

    useEffect(() => {
        loadData();
    }, [loadData]);


    // --- Return Modal Logic (Unchanged from previous version) ---
    const openReturnModal = (record) => {
        console.log("Opening return modal for record:", record._id, "Book:", record.bookRef?.title);
        if (!record || !record._id || !record.bookRef) {
             console.error("Cannot open return modal: Invalid record data provided.", record);
             setError("Cannot initiate return: Missing record information.");
             return;
         }
        setCurrentRecordForReturn(record);
        setReturnInteractionState({
             processStage: 'capturing',
             capturedImages: Array(REQUIRED_PHOTOS).fill(null),
             cameraError: null,
             submitError: null,
             isSubmitting: false,
         });
        setShowReturnModal(true);
    };

    const closeReturnModal = () => {
        setShowReturnModal(false);
        setCurrentRecordForReturn(null);
         setReturnInteractionState({
             processStage: 'capturing',
             capturedImages: Array(REQUIRED_PHOTOS).fill(null),
             cameraError: null,
             submitError: null,
             isSubmitting: false,
         });
    };

    const handleReturnCapture = useCallback(() => {
         if (!returnWebcamRef.current) {
             setReturnInteractionState(prev => ({...prev, cameraError: "Camera component not available."}));
             return;
         }
        const imageSrc = returnWebcamRef.current.getScreenshot({ width: 640, height: 480 });
        if (!imageSrc) {
              setReturnInteractionState(prev => ({...prev, cameraError: "Failed to capture image."}));
              return;
         }

        const nextEmptyIndex = returnInteractionState.capturedImages.findIndex(img => img === null);
        if (nextEmptyIndex !== -1) {
            const updatedImages = [...returnInteractionState.capturedImages];
            updatedImages[nextEmptyIndex] = imageSrc;
             setReturnInteractionState(prev => ({
                 ...prev,
                 capturedImages: updatedImages,
                 cameraError: null
             }));
        }
    }, [returnInteractionState.capturedImages]);

     const handleReturnRetake = (index) => {
        const updatedImages = [...returnInteractionState.capturedImages];
        updatedImages[index] = null;
         setReturnInteractionState(prev => ({
             ...prev,
             capturedImages: updatedImages,
             processStage: 'capturing',
             submitError: null
         }));
    };

    const handleReturnSubmit = async () => {
        if (!currentRecordForReturn || !currentRecordForReturn._id) {
             setReturnInteractionState(prev => ({...prev, submitError: "No record selected for return."}));
             return;
        }
        if (returnInteractionState.capturedImages.some(img => img === null)) {
             setReturnInteractionState(prev => ({...prev, submitError: `Please capture all ${REQUIRED_PHOTOS} photos for the return.`}));
             return;
        }

        setReturnInteractionState(prev => ({
            ...prev,
            processStage: 'submitting',
            isSubmitting: true,
            submitError: null
        }));

        try {
             const payload = { userId: user._id, returnImages: returnInteractionState.capturedImages };
             await api.returnBook(currentRecordForReturn._id, payload);
             console.log("Book returned successfully via MyBorrows page for record:", currentRecordForReturn._id);
             closeReturnModal();
             await loadData(); // Reload both active and history

        } catch (err) {
             console.error("Error submitting return:", err);
             const errorMsg = err.response?.data?.message || `Failed to return the book. ${err.message || ''}`;
             setReturnInteractionState(prev => ({
                 ...prev,
                 submitError: errorMsg.trim(),
                 processStage: 'reviewing', // Go back to review stage on error
                 isSubmitting: false
             }));
        }
    };

    // --- Render Return Modal (Unchanged from previous version) ---
    const renderReturnModalContent = () => {
         const { processStage, capturedImages, cameraError, submitError, isSubmitting } = returnInteractionState;
         const photosTaken = capturedImages.filter(img => img !== null).length;
         const allPhotosTaken = photosTaken === REQUIRED_PHOTOS;

        if (!currentRecordForReturn || !currentRecordForReturn.bookRef) {
            return (
                 <div className="modal-overlay" onClick={closeReturnModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                         <p className="error-text">Error: Missing book information for return.</p>
                         <button onClick={closeReturnModal} className="button secondary-button">Close</button>
                    </div>
                 </div>
             );
        }

        return (
             <div className="modal-overlay" onClick={closeReturnModal}>
                 <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                     <div className="modal-header">
                         <h2>Return: {currentRecordForReturn.bookRef.title} ({photosTaken}/{REQUIRED_PHOTOS})</h2>
                         <button onClick={closeReturnModal} className="modal-close-button" aria-label="Close modal">×</button>
                     </div>
                     <div className="modal-body">
                         {processStage === 'capturing' && (
                            <div className="webcam-section">
                                 <div className="webcam-container">
                                     <Webcam
                                         audio={false}
                                         ref={returnWebcamRef}
                                         screenshotFormat="image/jpeg"
                                         width={640} height={480}
                                         videoConstraints={{ facingMode: "environment", width: 1280, height: 720 }}
                                         onUserMediaError={(err) => setReturnInteractionState(prev => ({...prev, cameraError: `Camera Error: ${err.name}`}))}
                                         onUserMedia={() => setReturnInteractionState(prev => ({...prev, cameraError: null}))}
                                     />
                                    {cameraError && <p className="error-text camera-error">{cameraError}</p>}
                                </div>
                                <button
                                     onClick={handleReturnCapture}
                                     className="button primary-button capture-main-button"
                                     disabled={isSubmitting || !!cameraError || allPhotosTaken}
                                     aria-label={allPhotosTaken ? "All photos taken" : `Capture photo ${photosTaken + 1} of ${REQUIRED_PHOTOS}`}
                                >
                                    {allPhotosTaken ? "All Photos Taken" : `Capture Photo`}
                                </button>
                            </div>
                        )}

                         <p className="thumbnail-instruction">
                            {allPhotosTaken || processStage === 'reviewing' ? 'Review photos before confirming return.' : `Requires ${REQUIRED_PHOTOS} photos for return.`}
                        </p>
                        <div className="image-thumbnails-grid">
                             {capturedImages.map((imgSrc, index) => (
                                <div key={index} className="thumbnail-slot">
                                    <p>Photo {index + 1}</p>
                                    {imgSrc ? (<img src={imgSrc} alt={`Return Preview ${index + 1}`} className="thumbnail-preview" />)
                                            : (<div className="thumbnail-placeholder">Empty</div>)
                                    }
                                    {imgSrc && processStage !== 'submitting' && (
                                        <button onClick={() => handleReturnRetake(index)} className="button tertiary-button retake-button" disabled={isSubmitting}>Retake</button>
                                    )}
                                </div>
                            ))}
                        </div>
                         {submitError && <p className="error-text submit-error">{submitError}</p>}
                     </div>

                     {/* Footer Actions */}
                     <div className="modal-footer">
                          {processStage === 'capturing' && !allPhotosTaken && (
                             <button onClick={closeReturnModal} className="button secondary-button">Cancel Return</button>
                         )}
                         {processStage === 'capturing' && allPhotosTaken && (
                              <>
                                 <button onClick={() => setReturnInteractionState(prev => ({...prev, processStage: 'reviewing'}))} className="button primary-button">Review & Confirm</button>
                                 <button onClick={closeReturnModal} className="button secondary-button">Cancel</button>
                              </>
                          )}
                         {processStage === 'reviewing' && (
                             <>
                                <button onClick={handleReturnSubmit} className="button primary-button submit-final-button" disabled={isSubmitting || !allPhotosTaken}>
                                   {isSubmitting ? <Spinner /> : 'Confirm Return'}
                                </button>
                                <button onClick={() => setReturnInteractionState(prev => ({...prev, processStage: 'capturing'}))} className="button secondary-button" disabled={isSubmitting}>Back to Capture</button>
                             </>
                         )}
                          {processStage === 'submitting' && <Spinner />}
                     </div>
                 </div>
             </div>
        );
    };

     // --- Image Error Handler ---
     const handleImageError = (e) => {
         e.target.onerror = null;
         e.target.src = 'https://via.placeholder.com/100x150?text=No+Image';
         e.target.classList.add('image-error');
     };


    // --- Main Component Render ---
    return (
        <div className="my-borrows-page">
            {/* *** HEADER UPDATED: Removed image next to title *** */}
            <header className="home-header my-borrows-header"> {/* Added specific class for potential overrides */}
                <div className="welcome-user">
                    {/* Removed user photo from here */}
                    <h1 className="header-title">{user?.name || 'Reader'}'s Borrows</h1>
                </div>
                <nav className="header-nav">
                    <Link to="/" className="button secondary-button header-nav-button">Back to Library</Link>
                    <button onClick={onLogout} className="button logout-button header-logout">Log Out</button>
                </nav>
            </header>

            <main className="my-borrows-content">
            {user && user.isBlocked && (
    <div className="error-text" style={{ backgroundColor: 'var(--error-bg)', padding: '10px', marginBottom: '15px', border: '1px solid var(--error-color)', borderRadius: 'var(--border-radius)'}}>
        Your account is currently blocked from borrowing new books due to overdue items or administrative action. Please return any overdue books or contact support.
    </div>
)}
                <h2 className="section-title">Currently Borrowed Books ({borrowedRecords.length}/{MAX_BORROW_LIMIT})</h2>

                {/* Loading/Error/Empty State for Active Borrows */}
                {isLoading && <div className="loading-container"><Spinner /><p>Loading borrowed books...</p></div>}
                {error && !isLoading && <p className="error-text">{error}</p>}
                {!isLoading && !error && borrowedRecords.length === 0 && (
                    <p className="info-text">You haven't borrowed any books yet. <Link to="/">Browse the library</Link> to find your next read!</p>
                )}

                {/* Active Borrows List */}
                {!isLoading && !error && borrowedRecords.length > 0 && (
                    <div className="borrowed-books-list">
                        {borrowedRecords.map((record) => (
                            <article key={record._id} className="borrowed-book-item card">
                                {record.bookRef?.image ? (<img src={record.bookRef.image} alt={`${record.bookRef.title || 'Book'} cover`} className="borrowed-book-cover" onError={handleImageError} loading="lazy"/>)
                                                      : (<div className="borrowed-book-cover-placeholder">No Image</div>)}
                                <div className="borrowed-book-info">
                                    <h3>{record.bookRef?.title || 'Book title missing'}</h3>
                                    <p>by {record.bookRef?.author || 'Unknown Author'}</p>
                                    <p className="due-date">Due: {formatDate(record.returnDate)}</p>
                                    <button onClick={() => openReturnModal(record)} className="button return-button-small primary-button" disabled={returnInteractionState.isSubmitting && currentRecordForReturn?._id === record._id}>
                                        {returnInteractionState.isSubmitting && currentRecordForReturn?._id === record._id ? <Spinner /> : 'Return Book'}
                                    </button>
                                </div>
                             </article>
                        ))}
                    </div>
                )}

                {/* --- Borrow History Section --- */}
                 <div className="borrow-history-section">
                     <h2 className="section-title history-title">Borrow History</h2>
                     {!isLoading && !error && historicalRecords.length === 0 && (
                         <p className="info-text">No past borrowing records found.</p>
                     )}
                     {!isLoading && !error && historicalRecords.length > 0 && (
                         <div className="borrowed-books-list history-list"> {/* Reuse list style or create new */}
                             {historicalRecords.map((record) => (
                                 <article key={record._id} className="borrowed-book-item history-item card"> {/* Reuse item style or create new */}
                                     {record.bookRef?.image ? (<img src={record.bookRef.image} alt={`${record.bookRef.title || 'Book'} cover`} className="borrowed-book-cover" onError={handleImageError} loading="lazy"/>)
                                                      : (<div className="borrowed-book-cover-placeholder">No Image</div>)}
                                     <div className="borrowed-book-info history-info">
                                         <h3>{record.bookRef?.title || 'Book title missing'}</h3>
                                         <p>by {record.bookRef?.author || 'Unknown Author'}</p>
                                         <div className="history-dates">
                                             <p>Borrowed: {formatDate(record.borrowDate)}</p>
                                             <p>Returned: {formatDate(record.actualReturnDate)}</p>
                                         </div>
                                         {/* No action button needed for history */}
                                     </div>
                                 </article>
                             ))}
                         </div>
                     )}
                 </div>

            </main>

            {/* Render the Return Modal */}
            {showReturnModal && currentRecordForReturn && renderReturnModalContent()}

            <footer className="home-footer"><p>© {new Date().getFullYear()} Library Management System</p></footer>
        </div>
    );
}