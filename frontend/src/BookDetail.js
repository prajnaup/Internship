// frontend/src/BookDetail.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom'; // Removed Link as it wasn't used directly here
import API from './api';

// Simple Spinner component (can be more elaborate)
const Spinner = () => <div className="spinner"></div>;

export default function BookDetail({ user }) {
  const { bookId } = useParams();
  const navigate = useNavigate();

  const [book, setBook] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBookDetails = async () => {
      setIsLoading(true);
      setError(null);
      console.log(`Fetching details for book ID: ${bookId}`);
      try {
        const response = await API.get(`/books/${bookId}`);
        console.log("Book details fetched:", response.data);
        setBook(response.data);
      } catch (err) {
        console.error("Error fetching book details:", err.response?.data || err.message);
        if (err.response?.status === 404) {
          setError('Book not found.');
        } else {
          setError('Failed to load book details. Please try again later.');
        }
        setBook(null);
      } finally {
        setIsLoading(false);
      }
    };

    if (bookId) {
      fetchBookDetails();
    } else {
        setError("No book ID provided.");
        setIsLoading(false);
    }

  }, [bookId]);

  const handleImageError = (e) => {
    e.target.onerror = null;
    e.target.src = 'https://via.placeholder.com/300x450?text=No+Image+Available';
    e.target.classList.add('image-error');
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <div className="book-detail-page">
      <header className="book-detail-header">
          <button onClick={handleGoBack} className="back-button">
             <span role="img" aria-label="Back arrow">⬅️</span> Back to Library
          </button>
          {/* Optional: Add User Avatar/Logout like in Home Header if desired */}
           {/* <div className="header-user-info"> ... {user.name} ... </div> */}
      </header>

      <main className="book-detail-main-content">
        {isLoading && (
          <div className="loading-container">
              <Spinner />
              <p className="loading-text">Loading book details...</p>
          </div>
        )}

        {error && (
          <div className="error-container">
             <p className="error-text">{error}</p>
             <button onClick={handleGoBack} className="button secondary-button">Go Back</button>
          </div>
        )}

        {!isLoading && !error && book && (
          <div className="book-detail-content-wrapper">
            {/* --- Left Column: Cover Image & Actions --- */}
            <div className="book-detail-cover-column"> {/* Renamed container */}
              <div className="book-detail-cover-container"> {/* Added inner container for sticky positioning */}
                <img
                  src={book.image || 'https://via.placeholder.com/300x450?text=No+Image+Available'}
                  alt={`${book.title} cover`}
                  className="book-detail-cover"
                  onError={handleImageError}
                />
              </div>
              {/* --- Action Button moved here --- */}
              <div className="book-detail-actions below-cover">
                 <button
                    className="button action-button primary borrow-button"
                    disabled={!book.availableCopies || book.availableCopies <= 0} // Check existence too
                    onClick={() => alert('Borrow functionality not implemented yet.')} // Placeholder action
                 >
                     {book.availableCopies > 0 ? 'Borrow Book' : 'Unavailable'}
                 </button>
                 {/* Add other actions like "Add to Wishlist" here if needed */}
                 {/* <button className="button action-button secondary wishlist-button">Add to Wishlist</button> */}
              </div>
            </div>

            {/* --- Right Column: Book Information --- */}
            <div className="book-detail-info-container">
              <h1 className="book-detail-title">{book.title}</h1>
              <p className="book-detail-author">
                by <a href={`/search?author=${encodeURIComponent(book.author)}`} className="author-link">{book.author}</a> {/* Example link */}
              </p>

              {/* --- Meta Info Row (Genre, Availability) --- */}
              <div className="book-detail-meta">
                 {book.genre && (
                    <span className="book-detail-genre-tag">
                      {book.genre}
                    </span>
                 )}
                 <span className={`book-detail-availability ${book.availableCopies > 0 ? 'available' : 'unavailable'}`}>
                   {book.availableCopies > 0
                       ? `✅ ${book.availableCopies} available`
                       : `❌ Unavailable`
                   }
                   <span className="total-copies"> / {book.copies ?? 'N/A'} total</span>
                 </span>
                 {/* Add Rating here if available - e.g., <span className="book-rating">⭐️ 4.5</span> */}
              </div>


              {/* --- About Section --- */}
              <div className="book-detail-about">
                <h2>About this book</h2>
                <p className="about-text">{book.about || 'No description available.'}</p>
              </div>

              {/* --- More Details Section (Optional) --- */}
              {/* <div className="book-detail-extra-info">
                <h2>Details</h2>
                 <ul>
                    <li><strong>Pages:</strong> {book.pages || 'N/A'}</li>
                    <li><strong>Publisher:</strong> {book.publisher || 'N/A'}</li>
                    <li><strong>Published Date:</strong> {book.publishDate || 'N/A'}</li>
                 </ul>
              </div> */}

            </div>
          </div>
        )}
         {!isLoading && !error && !book && (
             <div className="error-container">
                <p className="error-text">Book data could not be loaded.</p>
                 <button onClick={handleGoBack} className="button secondary-button">Go Back</button>
             </div>
         )}
      </main>
       <footer className="home-footer">
         <p>© {new Date().getFullYear()} Your Library App</p>
       </footer>
    </div>
  );
}