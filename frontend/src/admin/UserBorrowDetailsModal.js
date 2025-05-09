// frontend/src/admin/UserBorrowDetailsModal.js
import React, { useState, useEffect } from 'react';
import * as api from '../api';
import '../styles.css';
import './adminStyles.css';

const Spinner = () => <div className="spinner"></div>;
const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString(); // More detail including time
};

export default function UserBorrowDetailsModal({ isOpen, onClose, user }) { // adminUser prop removed from here
    const [borrowRecords, setBorrowRecords] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen && user?._id) {
            const fetchDetails = async () => {
                setIsLoading(true);
                setError('');
                try {
                    // The adminUserId for auth is now handled by the API interceptor via x-admin-user-id header
                    const response = await api.adminFetchUserBorrows(user._id);
                    setBorrowRecords(response.data);
                } catch (err) {
                    setError(err.response?.data?.message || "Failed to fetch borrow details.");
                    console.error("Error fetching user borrow details:", err);
                } finally {
                    setIsLoading(false);
                }
            };
            fetchDetails();
        }
    }, [isOpen, user]); // Removed adminUser from dependency array

    if (!isOpen || !user) return null;

    const activeBorrows = borrowRecords.filter(r => r.status === 'borrowed');
    const borrowHistory = borrowRecords.filter(r => r.status === 'returned');

    return (
        <div className="modal-overlay admin-modal user-borrow-details-modal" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Borrowing Details for: {user.name}</h2>
                    <button onClick={onClose} className="modal-close-button" aria-label="Close modal">×</button>
                </div>
                <div className="modal-body">
                    {isLoading && <div className="loading-container"><Spinner />Loading details...</div>}
                    {error && <p className="error-text submit-error">{error}</p>}
                    
                    {!isLoading && !error && (
                        <>
                            <h3>Currently Borrowed ({activeBorrows.length})</h3>
                            {activeBorrows.length === 0 ? <p className="admin-info-text">No active borrows.</p> : (
                                activeBorrows.map(record => (
                                    <div key={record._id} className="borrow-item">
                                        {record.bookRef?.image && <img src={record.bookRef.image} alt={record.bookRef.title} className="book-image-small" />}
                                        <div className="borrow-item-content">
                                            <p><strong>Title:</strong> {record.bookRef?.title || 'N/A'} ({record.bookRef?.bookid || 'N/A'})</p>
                                            {/* <p><strong>Author:</strong> {record.bookRef?.author || 'N/A'}</p> */}
                                            <p><strong>Borrowed:</strong> {formatDate(record.borrowDate)}</p>
                                            <p><strong>Due:</strong> {formatDate(record.returnDate)}</p>
                                        </div>
                                    </div>
                                ))
                            )}

                            <h3>Borrow History ({borrowHistory.length})</h3>
                            {borrowHistory.length === 0 ? <p className="admin-info-text">No borrow history.</p> : (
                                borrowHistory.map(record => (
                                    <div key={record._id} className="borrow-item">
                                        {record.bookRef?.image && <img src={record.bookRef.image} alt={record.bookRef.title} className="book-image-small" />}
                                         <div className="borrow-item-content">
                                            <p><strong>Title:</strong> {record.bookRef?.title || 'N/A'} ({record.bookRef?.bookid || 'N/A'})</p>
                                            {/* <p><strong>Author:</strong> {record.bookRef?.author || 'N/A'}</p> */}
                                            <p><strong>Borrowed:</strong> {formatDate(record.borrowDate)}</p>
                                            <p><strong>Returned:</strong> {formatDate(record.actualReturnDate)}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </>
                    )}
                </div>
                <div className="modal-footer">
                    <button type="button" className="button secondary-button" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
}