// frontend/src/admin/AddBookModal.js
import React, { useState } from 'react';
import * as api from '../api';
import '../styles.css';
import './adminStyles.css';

const Spinner = () => <div className="spinner"></div>;

export default function AddBookModal({ isOpen, onClose, onBookAdded }) {
    const [bookData, setBookData] = useState({
        title: '',
        bookid: '',
        author: '',
        genre: '',
        about: '', // Added about here
        image: '',
        copies: 1,
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (e) => {
        const { name, value } = e.target;
        setBookData(prev => ({ ...prev, [name]: value }));
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        if (!bookData.title || !bookData.bookid || !bookData.author || !bookData.genre || !bookData.image || bookData.copies < 0) {
            setError("Please fill all required fields and ensure copies is not negative.");
            setIsLoading(false);
            return;
        }

        try {
            // adminUserId is sent via header by the API interceptor
            const response = await api.adminAddBook(bookData);
            onBookAdded(response.data.book);
            handleClose();
        } catch (err) {
            setError(err.response?.data?.message || "Failed to add book.");
            console.error("Error adding book:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setBookData({ title: '', bookid: '', author: '', genre: '', about: '', image: '', copies: 1 });
        setError('');
        setIsLoading(false);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay admin-modal" onClick={handleClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Add New Book</h2>
                    <button onClick={handleClose} className="modal-close-button" aria-label="Close modal">×</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        {error && <p className="error-text submit-error" style={{textAlign: 'center', marginBottom: '15px'}}>{error}</p>}
                        <div className="form-group">
                            <label htmlFor="add-title">Title *</label>
                            <input type="text" name="title" id="add-title" value={bookData.title} onChange={handleChange} required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="add-bookid">Book ID *</label>
                            <input type="text" name="bookid" id="add-bookid" value={bookData.bookid} onChange={handleChange} required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="add-author">Author *</label>
                            <input type="text" name="author" id="add-author" value={bookData.author} onChange={handleChange} required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="add-genre">Genre *</label>
                            <input type="text" name="genre" id="add-genre" value={bookData.genre} onChange={handleChange} required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="add-about">About</label>
                            <textarea name="about" id="add-about" value={bookData.about} onChange={handleChange} rows="4"></textarea>
                        </div>
                        <div className="form-group">
                            <label htmlFor="add-image">Image URL *</label>
                            <input type="url" name="image" id="add-image" value={bookData.image} onChange={handleChange} required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="add-copies">Total Copies *</label>
                            <input type="number" name="copies" id="add-copies" value={bookData.copies} onChange={handleChange} min="0" required />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="button secondary-button" onClick={handleClose} disabled={isLoading}>Cancel</button>
                        <button type="submit" className="button primary-button" disabled={isLoading}>
                            {isLoading ? <Spinner /> : 'Add Book'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}