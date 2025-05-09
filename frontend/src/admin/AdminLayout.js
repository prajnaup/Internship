// frontend/src/admin/AdminLayout.js
import React, { useState, useEffect, createContext, useContext } from 'react'; // Added createContext, useContext
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { googleLogout } from '@react-oauth/google';
import './adminStyles.css';

// --- Confirmation Modal Logic ---
// Define Context and Hook first, and export them for use in child components
export const ConfirmationContext = createContext(null);

export const useConfirmation = () => {
    const context = useContext(ConfirmationContext);
    if (!context) {
        throw new Error('useConfirmation must be used within a ConfirmationProvider hosted by AdminLayout');
    }
    return context;
};

// Define ConfirmModal component (internal to AdminLayout)
const ConfirmModalComponent = ({ isOpen, onClose, onConfirm, title, message, confirmButtonText = "Confirm", confirmButtonClass = "primary-button" }) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay admin-modal" onClick={onClose}>
            <div className="modal-content admin-confirm-modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{title || 'Confirm Action'}</h2>
                    <button onClick={onClose} className="modal-close-button" aria-label="Close modal">×</button>
                </div>
                <div className="modal-body">
                    <p>{message}</p>
                </div>
                <div className="modal-footer">
                    <button type="button" className="button secondary-button" onClick={onClose}>Cancel</button>
                    <button type="button" className={`button ${confirmButtonClass}`} onClick={onConfirm}>
                        {confirmButtonText}
                    </button>
                </div>
            </div>
        </div>
    );
};
// --- End Confirmation Modal Logic ---


const AdminLayout = ({ user, setUser }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const [flashMessage, setFlashMessage] = useState(null);

    const [confirmModalState, setConfirmModalState] = useState({
        isOpen: false,
        message: '',
        title: '',
        onConfirm: () => {},
        confirmButtonText: "Confirm",
        confirmButtonClass: "primary-button"
    });

    // This function will be provided via context to child components
    const showConfirmationModal = (
        message,
        onConfirmAction,
        title = "Confirm Action",
        confirmButtonText = "Confirm",
        confirmButtonClass = "primary-button" // e.g., "error-button" for destructive actions
    ) => {
        setConfirmModalState({
            isOpen: true,
            message,
            title,
            onConfirm: () => { // This wrapper ensures the modal closes after the action
                onConfirmAction();
                setConfirmModalState(prev => ({ ...prev, isOpen: false, onConfirm: () => {} })); // Reset onConfirm
            },
            confirmButtonText,
            confirmButtonClass
        });
    };
    
    const closeConfirmationModal = () => {
        setConfirmModalState(prev => ({ ...prev, isOpen: false, onConfirm: () => {} })); // Reset onConfirm
    };

    useEffect(() => {
        if (location.state?.message) {
            setFlashMessage({ text: location.state.message, type: location.state.messageType || 'info' });
            navigate(location.pathname, { replace: true, state: {} });
            const timer = setTimeout(() => {
                setFlashMessage(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [location.state, navigate, location.pathname]);

    const handleAdminLogout = () => {
        showConfirmationModal(
            "Are you sure you want to log out?",
            () => { // This is the onConfirmAction
                googleLogout();
                localStorage.removeItem('user');
                setUser(null);
                navigate('/signin');
            },
            "Logout Confirmation", // Title
            "Log Out", // Confirm button text
            "error-button" // Confirm button class
        );
    };

    if (!user || user.role !== 'admin') {
        return <p>Unauthorized. Redirecting...</p>;
    }

    return (
        <ConfirmationContext.Provider value={{ showConfirmationModal }}> {/* Provide the function to children */}
            <div className="admin-layout">
                <aside className="admin-sidebar">
                    <div className="admin-sidebar-header">
                        <h2>Admin Panel</h2>
                        <p>Welcome, {user.name}</p>
                    </div>
                    <nav className="admin-nav">
                        <NavLink to="/admin/manage-books" className={({ isActive }) => isActive ? "admin-nav-link active" : "admin-nav-link"}>Manage Books</NavLink>
                        <NavLink to="/admin/user-management" className={({ isActive }) => isActive ? "admin-nav-link active" : "admin-nav-link"}>User Management</NavLink>
                        <NavLink to="/admin/overdue-users" className={({ isActive }) => isActive ? "admin-nav-link active" : "admin-nav-link"}>Overdue Users</NavLink>
                    </nav>
                    <button onClick={handleAdminLogout} className="admin-logout-button">Log Out</button>
                </aside>
                <main className="admin-main-content">
                    {flashMessage && (
                        <div className={`admin-flash-message ${flashMessage.type}`}>
                            {flashMessage.text}
                            <button onClick={() => setFlashMessage(null)}>×</button>
                        </div>
                    )}
                    <Outlet /> {/* Child routes will render here and can access showConfirmationModal via context */}
                </main>
                {/* Render the modal itself, its visibility is controlled by confirmModalState */}
                <ConfirmModalComponent
                    isOpen={confirmModalState.isOpen}
                    onClose={closeConfirmationModal}
                    onConfirm={confirmModalState.onConfirm}
                    title={confirmModalState.title}
                    message={confirmModalState.message}
                    confirmButtonText={confirmModalState.confirmButtonText}
                    confirmButtonClass={confirmModalState.confirmButtonClass}
                />
            </div>
        </ConfirmationContext.Provider>
    );
};

export default AdminLayout;