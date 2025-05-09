// frontend/src/admin/ManageBooks.js
import React, { useState, useEffect, useCallback } from 'react'; // Removed useContext, will get from AdminLayout
import * as api from '../api';
import AddBookModal from './AddBookModal';
import EditBookModal from './EditBookModal';
import '../styles.css';
import './adminStyles.css';
import { useConfirmation } from './AdminLayout'; // Import the hook

const Spinner = () => <div className="spinner"></div>;

export default function ManageBooks({ adminUser }) {
    const { showConfirmationModal } = useConfirmation(); // Use the hook from context
    const [books, setBooks] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [currentBook, setCurrentBook] = useState(null);

    const fetchAllBooksForAdmin = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await api.adminFetchAllBooks();
            setBooks(response.data);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to fetch books.");
            console.error("Error fetching books for admin:", err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAllBooksForAdmin();
    }, [fetchAllBooksForAdmin]);

    const handleBookAdded = (newBook) => {
        setBooks(prevBooks => [newBook, ...prevBooks]);
    };

    const handleBookUpdated = (updatedBook) => {
        setBooks(prevBooks => prevBooks.map(b => b._id === updatedBook._id ? updatedBook : b));
    };

    const openEditModal = (book) => {
        setCurrentBook(book);
        setShowEditModal(true);
    };

    const handleDeleteBook = async (bookToDelete) => {
        if (!adminUser?._id) {
            alert("Admin authorization context error. Please re-login.");
            return;
        }
        
        showConfirmationModal(
            `Are you sure you want to delete "${bookToDelete.title}"? This action cannot be undone.`,
            async () => { // onConfirm action
                try {
                    await api.adminDeleteBook(bookToDelete._id);
                    setBooks(prevBooks => prevBooks.filter(b => b._id !== bookToDelete._id));

                } catch (err) {
                    alert(`Failed to delete book: ${err.response?.data?.message || err.message}`);
                    console.error("Error deleting book:", err);
                }
            },
            "Confirm Deletion", // Title
            "Delete", // Confirm button text
            "error-button" // Confirm button class
        );
    };

    if (isLoading) return <div className="loading-container"><Spinner />Loading books...</div>;
    if (error) return <p className="error-text">{error}</p>;

    return (
        <div>
            <div className="admin-section-header">
                <h1>Manage Books</h1>
                <button className="button primary-button" onClick={() => setShowAddModal(true)}>Add New Book</button>
            </div>
            
            {books.length === 0 && <p className="admin-info-text">No books found.</p>}

            <table className="admin-table">
                <thead>
                    <tr>
                        <th>Book ID</th>
                        <th>Title</th>
                        <th>Author</th>
                        <th>Genre</th>
                        <th>Copies</th>
                        <th>Available</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {books.map(book => (
                        <tr key={book._id}>
                            <td>{book.bookid}</td>
                            <td>{book.title}</td>
                            <td>{book.author}</td>
                            <td>{book.genre}</td>
                            <td>{book.copies}</td>
                            <td>{book.availableCopies}</td>
                            <td>
                                <div className="button-group">
                                    <button className="button secondary-button" onClick={() => openEditModal(book)}>Edit</button>
                                    <button className="button error-button" onClick={() => handleDeleteBook(book)}>Delete</button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <AddBookModal 
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onBookAdded={handleBookAdded}
            />
            {currentBook && (
                <EditBookModal
                    isOpen={showEditModal}
                    onClose={() => { setShowEditModal(false); setCurrentBook(null); }}
                    book={currentBook}
                    onBookUpdated={handleBookUpdated}
                />
            )}
        </div>
    );
}