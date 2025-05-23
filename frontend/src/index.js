import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles.css'; // Import global styles

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <React.Suspense fallback={<div className="loading-screen">Loading...</div>}>
        <App />
      </React.Suspense>
    </BrowserRouter>
  </React.StrictMode>
);