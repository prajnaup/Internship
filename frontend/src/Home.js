// frontend/src/Home.js
import React, { useState, useEffect } from 'react';
import * as api from './api';
import { Link } from 'react-router-dom';
import './styles.css';

const Spinner = () => <div className="spinner"></div>;

export default function Home({ user, onLogout }) {
  const [books, setBooks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const [activeSearchTerm, setActiveSearchTerm] = useState('');

  useEffect(() => {
    const fetchBooks = async () => {
      setIsLoading(true);
      setError(null);
      console.log("Fetching available books from /api/books");
      try {
        const response = await api.fetchBooks();
        console.log("API Response data:", response.data); // Log raw data

        // **Crucial Step: Ensure bookid is present and is a string**
        const booksWithProcessedId = (response.data || []).map(book => {
          // Log the book before processing
          // console.log("Processing book:", book);
          return {
            ...book,
            // Ensure bookid exists and is treated as a string for consistent searching
            // Handle potential null/undefined/number cases
            bookid: book.bookid ? String(book.bookid).trim() : '',
            // Ensure genre is also handled if needed (though usually a simple string)
            genre: book.genre ? String(book.genre).trim() : ''
          };
        });

        console.log("Processed books with ID and Genre:", booksWithProcessedId); // Log processed data
        setBooks(booksWithProcessedId);

      } catch (err) {
        console.error("Error fetching books:", err);
        setError(err.response?.data?.message || 'Failed to load books. Please try again later.');
        setBooks([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBooks();
  }, []);

  const handleSearchInputChange = (event) => {
    setSearchInput(event.target.value);
  };

  const handleSearchSubmit = () => {
    setActiveSearchTerm(searchInput.trim());
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setActiveSearchTerm('');
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSearchSubmit();
    }
  };

  // --- Filtering logic re-verified ---
  const filteredBooks = books.filter((book) => {
    const term = activeSearchTerm.toLowerCase();
    if (!term) return true; // Show all if search is empty

    // Check each field, ensuring it exists and converting to lowercase
    const titleMatch = book.title && book.title.toLowerCase().includes(term);
    const authorMatch = book.author && book.author.toLowerCase().includes(term);
    // *** GENRE MATCH IS ALREADY HERE ***
    const genreMatch = book.genre && book.genre.toLowerCase().includes(term);
    // Check bookid (which should now always be a string from useEffect)
    const bookidMatch = book.bookid && book.bookid.toLowerCase().includes(term);

    // Uncomment for debugging specific non-matches:
    // console.log(`Filtering: ${book.title} (ID: ${book.bookid}, Genre: ${book.genre}) | Term: "${term}" | Matches: title=${titleMatch}, author=${authorMatch}, genre=${genreMatch}, bookid=${bookidMatch}`);

    return titleMatch || authorMatch || genreMatch || bookidMatch;
  });

  const handleImageError = (e) => {
    e.target.onerror = null;
    e.target.src = 'https://via.placeholder.com/150x220?text=No+Image';
    e.target.classList.add('image-error');
  };

  return (
    <div className="home-page-container">
      {/* Header */}
      <header className="home-header">
        <div className="welcome-user">
            <h1 className="header-title">Welcome, {user?.name || 'Reader'}!</h1>
        </div>
        <nav className="header-nav">
            <Link to="/my-borrows" className="button secondary-button header-nav-button">My Borrows</Link>
            <button onClick={onLogout} className="button logout-button header-logout">Log Out</button>
        </nav>
      </header>

      {/* Main Content */}
      <main className="book-display-area">
         {/* Search Area */}
         <div className="section-header-with-search">
            <h2 className="section-title">Discover Your Next Read</h2>
            <div className="search-container">
                <input
                    type="text"
                    placeholder="Search by title, author, genre..." // Updated placeholder
                    className="search-input"
                    value={searchInput}
                    onChange={handleSearchInputChange}
                    onKeyDown={handleKeyDown}
                    aria-label="Search for books by title, author, genre, or ID"
                />
                 <button onClick={handleSearchSubmit} className="button primary-button search-submit-button" aria-label="Submit search">
                    Search
                 </button>
                 {activeSearchTerm && (
                    <button onClick={handleClearSearch} className="button secondary-button clear-search-button" aria-label="Clear search results">
                        Clear Search
                    </button>
                 )}
            </div>
         </div>

        {/* Loading/Error States */}
        {isLoading && (<div className="loading-container"> <Spinner /><p className="loading-text">Loading books...</p></div>)}
        {error && <p className="error-text">{error}</p>}

        {/* Search Results Indicator */}
        {!isLoading && !error && activeSearchTerm && (
            <p className="search-results-indicator">Showing results for: <strong>"{activeSearchTerm}"</strong></p>
        )}

        {/* Book Grid */}
        {!isLoading && !error && filteredBooks.length > 0 && (
          <div className="book-grid">
            {filteredBooks.map((book) => (
             <Link key={book._id} to={`/books/${book._id}`} className="book-card-link" aria-label={`View details for ${book.title}`}>
               <article className="book-card">
                  <img src={book.image || 'https://via.placeholder.com/150x220?text=No+Image'} alt={`${book.title} cover`} className="book-cover" onError={handleImageError} loading="lazy"/>
                  <div className="book-info">
                    <h3 className="book-title">{book.title}</h3>
                    <p className="book-author">by {book.author}</p>
                    {/* Optionally display genre on card if needed */}
                    {/* <p className="book-genre-small">{book.genre}</p> */}
                  </div>
               </article>
             </Link>
            ))}
          </div>
        )}

        {/* No Books Message */}
        {!isLoading && !error && filteredBooks.length === 0 && (
          <p className="info-text">
            {activeSearchTerm ? `No books found matching "${activeSearchTerm}". Try a different search term.` : 'No books are currently available in the library.'}
             {activeSearchTerm && (<button onClick={handleClearSearch} className="button tertiary-button" style={{marginLeft: '10px', marginTop: '10px', padding: '5px 15px', fontSize: '0.9rem'}}>Show All Books</button>)}
          </p>
        )}
      </main>

       {/* Footer */}
       <footer className="home-footer"><p>© {new Date().getFullYear()} Library Management System</p></footer>
    </div>
  );
}