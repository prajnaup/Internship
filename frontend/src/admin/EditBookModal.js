// frontend/src/admin/EditBookModal.js
import React, { useState, useEffect } from 'react';
import * as api from '../api';
import '../styles.css';
import './adminStyles.css';

const Spinner = () => <div className="spinner"></div>;

export default function EditBookModal({ isOpen, onClose, book, onBookUpdated }) {
    const [bookData, setBookData] = useState({
        title: '',
        bookid: '',
        author: '',
        genre: '',
        about: '', // Added about
        image: '',
        copies: 0,
        availableCopies: 0,
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (book) {
            setBookData({
                title: book.title || '',
                bookid: book.bookid || '',
                author: book.author || '',
                genre: book.genre || '',
                about: book.about || '', // Populate about
                image: book.image || '',
                copies: book.copies || 0,
                availableCopies: book.availableCopies || 0,
            });
        } else { // Reset form if no book is passed (e.g., after closing)
            setBookData({ title: '', bookid: '', author: '', genre: '', about: '', image: '', copies: 0, availableCopies: 0 });
        }
    }, [book]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setBookData(prev => ({ ...prev, [name]: value }));
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        if (parseInt(bookData.availableCopies) > parseInt(bookData.copies)) {
            setError("Available copies cannot exceed total copies.");
            setIsLoading(false);
            return;
        }
        if (parseInt(bookData.copies) < 0 || parseInt(bookData.availableCopies) < 0) {
            setError("Copies cannot be negative.");
            setIsLoading(false);
            return;
        }

        try {
            // adminUserId is sent via header by the API interceptor
            const response = await api.adminEditBook(book._id, bookData);
            onBookUpdated(response.data.book);
            handleClose();
        } catch (err) {
            setError(err.response?.data?.message || "Failed to update book.");
            console.error("Error updating book:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setError('');
        setIsLoading(false);
        onClose(); // This will also reset currentBook in ManageBooks.js
    };

    if (!isOpen || !book) return null;

    return (
        <div className="modal-overlay admin-modal" onClick={handleClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Edit Book: {book.title}</h2>
                    <button onClick={handleClose} className="modal-close-button" aria-label="Close modal">×</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        {error && <p className="error-text submit-error" style={{textAlign: 'center', marginBottom: '15px'}}>{error}</p>}
                        <div className="form-group">
                            <label htmlFor="edit-title">Title *</label>
                            <input type="text" name="title" id="edit-title" value={bookData.title} onChange={handleChange} required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="edit-bookid">Book ID *</label>
                            <input type="text" name="bookid" id="edit-bookid" value={bookData.bookid} onChange={handleChange} required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="edit-author">Author *</label>
                            <input type="text" name="author" id="edit-author" value={bookData.author} onChange={handleChange} required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="edit-genre">Genre *</label>
                            <input type="text" name="genre" id="edit-genre" value={bookData.genre} onChange={handleChange} required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="edit-about">About</label>
                            <textarea name="about" id="edit-about" value={bookData.about} onChange={handleChange} rows="4"></textarea>
                        </div>
                        <div className="form-group">
                            <label htmlFor="edit-image">Image URL *</label>
                            <input type="url" name="image" id="edit-image" value={bookData.image} onChange={handleChange} required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="edit-copies">Total Copies *</label>
                            <input type="number" name="copies" id="edit-copies" value={bookData.copies} onChange={handleChange} min="0" required />
                        </div>
                         <div className="form-group">
                            <label htmlFor="edit-availableCopies">Available Copies *</label>
                            <input type="number" name="availableCopies" id="edit-availableCopies" value={bookData.availableCopies} onChange={handleChange} min="0" required />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="button secondary-button" onClick={handleClose} disabled={isLoading}>Cancel</button>
                        <button type="submit" className="button primary-button" disabled={isLoading}>
                            {isLoading ? <Spinner /> : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}