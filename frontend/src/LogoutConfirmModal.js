// frontend/src/LogoutConfirmModal.js
// *** NEW FILE ***

import React from 'react';
import './styles.css'; // Reuse existing styles

export default function LogoutConfirmModal({ isOpen, onConfirm, onCancel }) {
  if (!isOpen) {
    return null; // Don't render anything if the modal isn't open
  }

  return (
    // Use existing modal overlay style for background dimming
    <div className="modal-overlay" onClick={onCancel}>
        {/* Add a specific class for potential styling differences */}
      <div className="modal-content logout-confirm-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header logout-confirm-header">
          <h2>Confirm Logout</h2>
          {/* Optional: Add a close button */}
           <button onClick={onCancel} className="modal-close-button" aria-label="Cancel logout">×</button>
        </div>
        <div className="modal-body logout-confirm-body">
          <p>Are you sure you want to log out?</p>
        </div>
        <div className="modal-footer logout-confirm-footer">
          <button onClick={onCancel} className="button secondary-button">
            Cancel
          </button>
          <button onClick={onConfirm} className="button logout-button"> {/* Use logout button style */}
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
}