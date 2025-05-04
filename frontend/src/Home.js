// frontend/src/Home.js
import React, { useState, useEffect } from 'react';
import * as api from './api'; // Use named import
import { Link } from 'react-router-dom';
import './styles.css'; // Ensure styles are imported

// Simple Spinner component (can be shared if needed)
const Spinner = () => <div className="spinner"></div>;

export default function Home({ user, onLogout }) {
  const [books, setBooks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBooks = async () => {
      setIsLoading(true);
      setError(null);
      console.log("Fetching available books from /api/books");
      try {
        const response = await api.fetchBooks();
        console.log("Books fetched:", response.data?.length);
        setBooks(response.data || []);
      } catch (err) {
        console.error("Error fetching books:", err);
        setError(err.response?.data?.message || 'Failed to load books. Please try again later.');
        setBooks([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBooks();
  }, []); // Empty dependency array means this runs once on mount

  // Function to handle image loading errors for book covers
  const handleImageError = (e) => {
    e.target.onerror = null; // Prevent infinite loop if placeholder fails
    e.target.src = 'https://via.placeholder.com/150x220?text=No+Image'; // Fallback placeholder
    e.target.classList.add('image-error'); // Optional: add class for styling
  };

  return (
    <div className="home-page-container">
      {/* --- Header Section --- */}
      <header className="home-header">
        <div className="welcome-user">
            {user?.photo ? (
              <img src={user.photo} alt={user.name || 'User'} className="header-avatar" />
            ) : (
              <div className="header-avatar-placeholder">{user?.name ? user.name.charAt(0).toUpperCase() : '?'}</div>
            )}
            <h1 className="header-title">Welcome, {user?.name || 'Reader'}!</h1>
        </div>
        {/* --- Navigation Links --- */}
        <nav className="header-nav">
            {/* Link to My Borrows page */}
            <Link to="/my-borrows" className="button secondary-button header-nav-button">My Borrows</Link>
            <button onClick={onLogout} className="button logout-button header-logout">Log Out</button>
        </nav>
      </header>

      {/* --- Main Content Area --- */}
      <main className="book-display-area">
        <h2 className="section-title">Discover Your Next Read</h2>

        {isLoading && (
          <div className="loading-container"> <Spinner /><p className="loading-text">Loading books...</p></div>
        )}
        {error && <p className="error-text">{error}</p>}

        {!isLoading && !error && books.length > 0 && (
          <div className="book-grid">
            {books.map((book) => (
             <Link key={book._id} to={`/books/${book._id}`} className="book-card-link" aria-label={`View details for ${book.title}`}>
               <article className="book-card"> {/* Use article for semantic meaning */}
                  <img
                    src={book.image || 'https://via.placeholder.com/150x220?text=No+Image'}
                    alt={`${book.title} cover`}
                    className="book-cover"
                    onError={handleImageError} // Add error handler
                    loading="lazy" // Add lazy loading for images
                  />
                  <div className="book-info">
                    <h3 className="book-title">{book.title}</h3>
                    <p className="book-author">by {book.author}</p>
                  </div>
               </article>
             </Link>
            ))}
          </div>
        )}

        {/* Message when no books are available or found */}
        {!isLoading && !error && books.length === 0 && (
          <p className="info-text">No books are currently available in the library.</p>
        )}
      </main>

       {/* --- Footer --- */}
       <footer className="home-footer">
         <p>© {new Date().getFullYear()} Library Management System</p>
       </footer>
    </div>
  );
}