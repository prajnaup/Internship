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
    const [error, setError] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [interactionState, setInteractionState] = useState({
        borrowStatus: 'loading',
        recordId: null,
        borrowCount: 0,
        modalMode: 'borrow',
        processStage: 'capturing',
        capturedImages: Array(REQUIRED_PHOTOS).fill(null),
        cameraError: null,
        submitError: null,
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
        setError(null);
        setInteractionState(prev => ({ ...prev, borrowStatus: 'loading' }));
        try {
            const [bookRes, borrowStatusRes] = await Promise.all([
                api.fetchBookDetails(bookId),
                api.getBorrowStatus(bookId, user._id)
            ]);
            if (!bookRes.data) throw new Error("Book not found.");
            setBook(bookRes.data);
            setInteractionState(prev => ({
                ...prev,
                borrowStatus: borrowStatusRes.data.status,
                recordId: borrowStatusRes.data.recordId,
                borrowCount: borrowStatusRes.data.borrowCount,
            }));
        } catch (err) {
            console.error("Error fetching book/borrow details:", err);
            const errorMsg = err.response?.data?.message || err.message || 'Failed to load book details or borrow status.';
            setError(errorMsg);
            setBook(null);
            setInteractionState(prev => ({ ...prev, borrowStatus: 'error', recordId: null, borrowCount: 0 }));
        } finally {
            setIsLoading(false);
        }
    }, [bookId, user?._id]);

    useEffect(() => {
        getBookAndBorrowData();
    }, [getBookAndBorrowData]);

    const openModal = (mode) => {
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
        setShowModal(false);
        setInteractionState(prev => ({
            ...prev,
            modalMode: 'borrow',
            processStage: 'capturing',
            capturedImages: Array(REQUIRED_PHOTOS).fill(null),
            cameraError: null,
            submitError: null,
            isSubmitting: false,
        }));
    };

    const handleCapture = useCallback(() => {
        if (!webcamRef.current) {
            setInteractionState(prev => ({ ...prev, cameraError: "Camera component not available." }));
            return;
        }
        const imageSrc = webcamRef.current.getScreenshot({ width: 640, height: 480 });
        if (!imageSrc) {
            setInteractionState(prev => ({ ...prev, cameraError: "Failed to capture image." }));
            return;
        }
        const nextEmptyIndex = interactionState.capturedImages.findIndex(img => img === null);
        if (nextEmptyIndex !== -1) {
            const updatedImages = [...interactionState.capturedImages];
            updatedImages[nextEmptyIndex] = imageSrc;
            setInteractionState(prev => ({ ...prev, capturedImages: updatedImages, cameraError: null }));
        }
    }, [interactionState.capturedImages]);

    const handleRetake = (index) => {
        const updatedImages = [...interactionState.capturedImages];
        updatedImages[index] = null;
        setInteractionState(prev => ({ ...prev, capturedImages: updatedImages, processStage: 'capturing', submitError: null }));
    };

    const handleSubmit = async () => {
        const { modalMode, capturedImages, recordId } = interactionState;
        const actionWord = modalMode === 'borrow' ? "Borrow" : "Return";
        if (capturedImages.some(img => img === null)) {
            setInteractionState(prev => ({ ...prev, submitError: `Please capture all ${REQUIRED_PHOTOS} photos.` }));
            return;
        }
        if (modalMode === 'return' && !recordId) {
            setInteractionState(prev => ({ ...prev, submitError: "Cannot return: Borrowing record ID is missing." }));
            return;
        }
        setInteractionState(prev => ({ ...prev, processStage: 'submitting', isSubmitting: true, submitError: null }));
        try {
            if (modalMode === 'borrow') {
                if (!book?._id) throw new Error("Book ID is missing for borrow.");
                await api.borrowBook(book._id, { userId: user._id, borrowImages: capturedImages });
            } else {
                await api.returnBook(recordId, { userId: user._id, returnImages: capturedImages });
            }
            closeModal();
            await getBookAndBorrowData();
        } catch (err) {
            const errorMsg = err.response?.data?.message || `Failed to ${actionWord.toLowerCase()} the book. ${err.message || ''}`;
            setInteractionState(prev => ({ ...prev, submitError: errorMsg.trim(), processStage: 'reviewing', isSubmitting: false }));
        }
    };

    const handleImageError = (e) => {
        e.target.onerror = null;
        e.target.src = 'https://via.placeholder.com/300x450?text=No+Image+Available';
        e.target.classList.add('image-error');
    };

    const handleGoBack = () => navigate(-1);

    const renderActionButton = () => {
        const { borrowStatus } = interactionState;
        if (borrowStatus === 'loading') return <button className="button action-button primary disabled-visual" disabled>Loading Status...</button>;
        if (borrowStatus === 'borrowedByUser') return <button onClick={() => openModal('return')} className="button action-button secondary return-button">Return Book</button>;
        if (borrowStatus === 'unavailable') return <button className="button action-button primary disabled-visual" disabled>Unavailable</button>;
        if (borrowStatus === 'limitReached') return <button className="button action-button primary disabled-visual" disabled title={`Borrow limit of ${MAX_BORROW_LIMIT} reached.`}>Borrow Limit Reached</button>;
        if (borrowStatus === 'canBorrow') return <button onClick={() => openModal('borrow')} className="button action-button primary borrow-button">Borrow Book</button>;
        if (borrowStatus === 'error') return <button className="button action-button primary disabled-visual" disabled>Error Loading Status</button>;
        return <button className="button action-button primary disabled-visual" disabled>...</button>;
    };

    const renderModalContent = () => {
        const { modalMode, processStage, capturedImages, cameraError, submitError, isSubmitting } = interactionState;
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
                                    <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" width={640} height={480} videoConstraints={{ facingMode: "environment", width: 1280, height: 720 }} onUserMediaError={(err) => setInteractionState(prev => ({...prev, cameraError:`Camera Error: ${err.name}. Ensure permissions are granted.`}))} onUserMedia={() => setInteractionState(prev => ({...prev, cameraError: null}))}/>
                                    {cameraError && <p className="error-text camera-error">{cameraError}</p>}
                                </div>
                                <button onClick={handleCapture} className="button primary-button capture-main-button" disabled={isSubmitting || !!cameraError || allPhotosTaken} aria-label={allPhotosTaken ? "All photos taken" : `Capture photo ${photosTaken + 1} of ${REQUIRED_PHOTOS}`}>
                                   {allPhotosTaken ? "All Photos Taken" : `Capture Photo`}
                                </button>
                            </div>
                        )}
                        <p className="thumbnail-instruction">{allPhotosTaken || processStage === 'reviewing' ? 'Review photos before confirming.' : `Requires ${REQUIRED_PHOTOS} photos for ${actionVerbGerund.toLowerCase()}.`}</p>
                        <div className="image-thumbnails-grid">
                            {capturedImages.map((imgSrc, index) => (
                                <div key={index} className="thumbnail-slot">
                                    <p>Photo {index + 1}</p>
                                    {imgSrc ? (<img src={imgSrc} alt={`Preview ${index + 1}`} className="thumbnail-preview" />)
                                            : (<div className="thumbnail-placeholder">Empty</div>) /* <-- UPDATED HERE */
                                    }
                                    {imgSrc && processStage !== 'submitting' && (
                                        <button onClick={() => handleRetake(index)} className="button tertiary-button retake-button" disabled={isSubmitting} aria-label={`Retake photo ${index + 1}`}>Retake</button>
                                    )}
                                </div>
                            ))}
                        </div>
                         {submitError && <p className="error-text submit-error">{submitError}</p>}
                     </div>
                     <div className="modal-footer">
                         {processStage === 'capturing' && !allPhotosTaken && (<button onClick={closeModal} className="button secondary-button">Cancel</button>)}
                         {processStage === 'capturing' && allPhotosTaken && (
                             <>
                                <button onClick={() => setInteractionState(prev => ({...prev, processStage:'reviewing'}))} className="button primary-button">Review & Confirm</button>
                                <button onClick={closeModal} className="button secondary-button">Cancel</button>
                             </>
                         )}
                         {processStage === 'reviewing' && (
                             <>
                                <button onClick={handleSubmit} className="button primary-button submit-final-button" disabled={isSubmitting || !allPhotosTaken}>{isSubmitting ? <Spinner /> : `Confirm ${actionWord}`}</button>
                                <button onClick={() => setInteractionState(prev => ({...prev, processStage:'capturing'}))} className="button secondary-button" disabled={isSubmitting}>Back to Capture</button>
                             </>
                         )}
                         {processStage === 'submitting' && (<Spinner />)}
                     </div>
                </div>
            </div>
        );
    };

    return (
        <>
            <div className="book-detail-page">
                <header className="book-detail-header">
                    <button onClick={handleGoBack} className="button back-button"><span role="img" aria-label="Back arrow">⬅️</span> Back</button>
                    {user && (
                        <div className="header-user-info">
                             <Link to="/my-borrows" className="button secondary-button header-nav-button" style={{marginRight: '15px'}}>My Borrows</Link>
                             <span>{user.name}</span>
                            {user.photo ? (<img src={user.photo} alt="" className="header-avatar-small" />) : (<div className="header-avatar-placeholder header-avatar-small">{user.name ? user.name.charAt(0).toUpperCase() : '?'}</div>)}
                            <button onClick={onLogout} className="button logout-button header-logout">Log Out</button>
                        </div>
                    )}
                </header>
                <main className="book-detail-main-content">
                    {isLoading && !book && (<div className="loading-container"><Spinner /><p>Loading book details...</p></div>)}
                    {error && !isLoading && (<div className="error-container"><p className="error-text">{error}</p><button onClick={handleGoBack} className="button secondary-button">Go Back</button></div>)}
                    {!isLoading && !error && book && (
                         <div className="book-detail-content-wrapper">
                            <div className="book-detail-cover-column">
                                <div className="book-detail-cover-container"><img src={book.image || 'https://via.placeholder.com/300x450?text=No+Image+Available'} alt={`${book.title} cover`} className="book-detail-cover" onError={handleImageError} loading="lazy"/></div>
                                <div className="book-detail-actions below-cover">{renderActionButton()}</div>
                            </div>
                             <div className="book-detail-info-container">
                                <h1 className="book-detail-title">{book.title}</h1>
                                <p className="book-detail-author">by {book.author}</p>
                                {book.bookid && (<p className="book-detail-bookid"><span className="bookid-label">Book ID:</span> {book.bookid}</p>)}
                                <div className="book-detail-meta">
                                    {book.genre && <span className="book-detail-genre-tag">{book.genre}</span>}
                                    <span className={`book-detail-availability ${book.availableCopies > 0 ? 'available' : 'unavailable'}`}>
                                        {interactionState.borrowStatus === 'borrowedByUser' ? `✅ Borrowed by You` : book.availableCopies > 0 ? `✅ ${book.availableCopies} available` : `❌ Unavailable`}
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
                 <footer className="home-footer"><p>© {new Date().getFullYear()} Library Management System</p></footer>
            </div>
            {showModal && renderModalContent()}
        </>
    );
}