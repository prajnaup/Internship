// frontend/src/Home.js
import React, { useState, useEffect } from 'react';
import API from './api'; // Your configured axios instance
// Optional: import { Link } from 'react-router-dom'; // If you want to link to book detail pages later

export default function Home({ user, onLogout }) {
  const [books, setBooks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBooks = async () => {
      setIsLoading(true);
      setError(null); // Reset error on new fetch
      console.log("Fetching books from /api/books");
      try {
        const response = await API.get('/books'); // Calls http://localhost:5000/api/books
        console.log("Books fetched:", response.data);
        setBooks(response.data || []); // Ensure books is always an array
      } catch (err) {
        console.error("Error fetching books:", err.response?.data || err.message);
        setError('Failed to load books. Please try again later.');
        setBooks([]); // Clear books on error
      } finally {
        setIsLoading(false);
      }
    };

    fetchBooks();
  }, []); // Empty dependency array means this runs once on mount

  return (
    <div className="home-page-container">
      {/* --- Header Section --- */}
      <header className="home-header">
        <div className="welcome-user">
            {user?.photo ? (
              <img src={user.photo} alt="User Avatar" className="header-avatar" />
            ) : (
              <div className="header-avatar-placeholder">{user?.name ? user.name.charAt(0).toUpperCase() : '?'}</div>
            )}
            <h1 className="header-title">Welcome, {user?.name || 'Reader'}!</h1>
        </div>
        <button onClick={onLogout} className="logout-button header-logout">Log Out</button>
      </header>

      {/* --- Main Content Area --- */}
      <main className="book-display-area">
        <h2 className="section-title">Discover Your Next Read</h2>

        {/* --- Loading State --- */}
        {isLoading && <p className="loading-text">Loading books...</p>}

        {/* --- Error State --- */}
        {error && <p className="error-text">{error}</p>}

        {/* --- Book Grid --- */}
        {!isLoading && !error && books.length > 0 && (
          <div className="book-grid">
            {books.map((book) => (
              <div key={book._id} className="book-card">
          
                  <img
                    src={book.image || 'https://via.placeholder.com/150x220?text=No+Image'} // Use placeholder if image missing
                    alt={`${book.title} cover`}
                    className="book-cover"
                    onError={(e) => { e.target.onerror = null; e.target.src='https://via.placeholder.com/150x220?text=No+Image'; }} // Handle broken image links
                  />
                  <div className="book-info">
                    <h3 className="book-title">{book.title}</h3>
                    <p className="book-author">by {book.author}</p>
                    {/* Add more info like genre or rating if needed */}
                  </div>
                {/* </Link> */}
              </div>
            ))}
          </div>
        )}

        {/* --- No Books Found State --- */}
        {!isLoading && !error && books.length === 0 && (
          <p className="info-text">No books found in the library yet.</p>
        )}
      </main>

       {/* Optional Footer */}
       {/* <footer className="home-footer"> */}
       {/*   <p>© {new Date().getFullYear()} Your Library</p> */}
       {/* </footer> */}
    </div>
  );
}