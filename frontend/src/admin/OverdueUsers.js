// frontend/src/admin/OverdueUsers.js
import React, { useState, useEffect } from 'react';
import * as api from '../api';
import { useConfirmation } from './AdminLayout'; // Import the hook

const Spinner = () => <div className="spinner"></div>;
const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
};

// Simple ImageModal component for displaying enlarged photos
const ImageModal = ({ isOpen, onClose, imageUrl, altText }) => {
    if (!isOpen) return null;

    return (
        <div className="image-modal-overlay" onClick={onClose}>
            <div className="image-modal-content" onClick={e => e.stopPropagation()}>
                <img src={imageUrl} alt={altText} className="enlarged-image" />
                <button 
                    onClick={onClose} 
                    className="image-modal-close-button" 
                    aria-label="Close image modal"
                >
                    ×
                </button>
            </div>
        </div>
    );
};


export default function OverdueUsers({ adminUser }) {
    const { showConfirmationModal } = useConfirmation(); // Use the hook
    const [overdueRecords, setOverdueRecords] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // State for image modal
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);
    const [enlargedImageUrl, setEnlargedImageUrl] = useState('');
    const [enlargedImageAlt, setEnlargedImageAlt] = useState('');

    const fetchOverdue = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await api.adminFetchOverdueUsers();
            setOverdueRecords(response.data);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to fetch overdue records.");
            console.error("Error fetching overdue records:", err);
        } finally {
            setIsLoading(false);
        }
    };
    
    useEffect(() => {
        fetchOverdue();
    }, []);

    const handleBlockUser = async (record) => {
        if (!adminUser?._id || !record.userId?._id) {
            alert("Admin or User ID missing. Cannot perform action.");
            return;
        }
        
        showConfirmationModal(
            `Are you sure you want to block ${record.userId.name} ?`,
            async () => { // onConfirm action
                try {
                    await api.adminBlockUser(record.userId._id, adminUser._id);
                    fetchOverdue(); 
                } catch (err) {
                    alert(`Failed to block user: ${err.response?.data?.message || err.message}`);
                    console.error("Error blocking user:", err);
                }
            },
            "Confirm Block User",
            "Block",
            "error-button"
        );
    };

    const handleOpenImageModal = (url, name) => {
        setEnlargedImageUrl(url);
        setEnlargedImageAlt(`Enlarged photo of ${name || 'user'}`);
        setIsImageModalOpen(true);
    };

    const handleCloseImageModal = () => {
        setIsImageModalOpen(false);
        setEnlargedImageUrl('');
        setEnlargedImageAlt('');
    };

    if (isLoading) return <div className="loading-container"><Spinner />Loading overdue records...</div>;
    if (error) return <p className="error-text">{error}</p>;

    return (
        <div>
            <h1>Overdue Users</h1>
            {overdueRecords.length === 0 && <p className="admin-info-text">No overdue users found.</p>}
            
            {overdueRecords.map(record => (
                <div key={record._id} className="overdue-user-card">
                    {record.userId?.photo ? (
                        <img 
                            src={record.userId.photo} 
                            alt={`Photo of ${record.userId.name}`} 
                            className="user-photo" 
                            onClick={() => handleOpenImageModal(record.userId.photo, record.userId.name)}
                            title="Click to enlarge photo"
                        />
                    ) : (
                        <div className="user-photo-placeholder">
                            <span>No Photo</span>
                        </div>
                    )}
                    {/* Restored structure: user-info and book-info are direct children of overdue-user-card */}
                    <div className="user-info">
                        <p><strong>User:</strong> {record.userId?.name || 'N/A'}</p>
                        <p><strong>Email:</strong> {record.userId?.email || 'N/A'}</p>
                        <p><strong>Phone:</strong> {record.userId?.phoneNumber || 'N/A'}</p>
                        {/* <p><strong>Status:</strong> {record.userId?.isBlocked ? <span className="blocked-user-text">Blocked</span> : <span className="active-user-text">Active</span>}</p> */}
                    </div>
                    <div className="book-info">
                        <p><strong>Book:</strong> {record.bookRef?.title || 'N/A'} ({record.bookRef?.bookid || 'N/A'})</p>
                        <p><strong>Borrowed:</strong> {formatDate(record.borrowDate)}</p>
                        <p><strong>Due:</strong> {formatDate(record.returnDate)}</p>
                    </div>
                    <div className="actions">
                        {!record.userId?.isBlocked ? (
                            <button className="button error-button" onClick={() => handleBlockUser(record)}>
                                Block User
                            </button>
                        ) : (
                            <span className="info-text blocked-user-text">User Blocked</span>
                        )}
                    </div>
                </div>
            ))}

            <ImageModal
                isOpen={isImageModalOpen}
                onClose={handleCloseImageModal}
                imageUrl={enlargedImageUrl}
                altText={enlargedImageAlt}
            />
        </div>
    );
}