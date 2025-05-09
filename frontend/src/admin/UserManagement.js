// frontend/src/admin/UserManagement.js
import React, { useState, useEffect, useCallback } from 'react'; // Removed useContext
import * as api from '../api';
import UserBorrowDetailsModal from './UserBorrowDetailsModal';
import '../styles.css';
import './adminStyles.css';
import { useConfirmation } from './AdminLayout'; // Import the hook

const Spinner = () => <div className="spinner"></div>;

const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
};

export default function UserManagement({ adminUser }) {
    const { showConfirmationModal } = useConfirmation(); // Use the hook
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showBorrowDetailsModal, setShowBorrowDetailsModal] = useState(false);
    const [selectedUserForDetails, setSelectedUserForDetails] = useState(null);

    const fetchAdminUsers = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await api.adminFetchUsers();
            setUsers(response.data);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to fetch users.");
            console.error("Error fetching users:", err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAdminUsers();
    }, [fetchAdminUsers]);

    const handleToggleBlock = async (userToToggle) => {
        if (!adminUser?._id) {
            alert("Admin user ID not found. Cannot perform action.");
            return;
        }
        const actionVerb = userToToggle.isBlocked ? 'unblock' : 'block';
        const actionPastTense = userToToggle.isBlocked ? 'unblocked' : 'blocked';
        const apiAction = userToToggle.isBlocked ? api.adminUnblockUser : api.adminBlockUser;
        
        const confirmButtonClass = userToToggle.isBlocked ? "success-button" : "error-button";
        const confirmButtonText = userToToggle.isBlocked ? "Unblock" : "Block";
        const modalTitle = `Confirm User ${actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1)}`;

        showConfirmationModal(
            `Are you sure you want to ${actionVerb} ${userToToggle.name}?`,
            async () => { // onConfirm action
                try {
                    await apiAction(userToToggle._id, adminUser._id);
                    setUsers(prevUsers =>
                        prevUsers.map(u =>
                            u._id === userToToggle._id ? { ...u, isBlocked: !u.isBlocked } : u
                        )
                    );
                    
                } catch (err) {
                    alert(`Failed to ${actionVerb} user: ${err.response?.data?.message || err.message}`);
                    console.error(`Error ${actionVerb}ing user:`, err);
                }
            },
            modalTitle,
            confirmButtonText,
            confirmButtonClass
        );
    };
    
    const handleShowBorrowDetails = (user) => {
        setSelectedUserForDetails(user);
        setShowBorrowDetailsModal(true);
    };

    if (isLoading) return <div className="loading-container"><Spinner />Loading users...</div>;
    if (error) return <p className="error-text">{error}</p>;

    return (
        <div>
            <h1>User Management</h1>
            {users.length === 0 && <p className="admin-info-text">No users found.</p>}
            <table className="admin-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Registered</th>
                        <th>Role</th>
                        {/* <th>Status</th> */}
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map(user => (
                        <tr key={user._id}>
                            <td>{user.name}</td>
                            <td>{user.email}</td>
                            <td>{user.phoneNumber}</td>
                            <td>{formatDate(user.registrationDate) || formatDate(user.createdAt)}</td>
                            <td>{user.role}</td>
                            {/* <td>
                                {user.isBlocked 
                                    ? <span className="blocked-user-text">Blocked</span> 
                                    : <span className="active-user-text">Active</span>
                                }
                            </td> */}
                            <td>
                                <div className="button-group">
                                    <button 
                                        className={`button ${user.isBlocked ? 'success-button' : 'error-button'}`}
                                        onClick={() => handleToggleBlock(user)}
                                    >
                                        {user.isBlocked ? 'Unblock' : 'Block'}
                                    </button>
                                    <button 
                                        className="button secondary-button" 
                                        onClick={() => handleShowBorrowDetails(user)}
                                    >
                                        Borrows
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            
            {selectedUserForDetails && (
                <UserBorrowDetailsModal 
                    isOpen={showBorrowDetailsModal} 
                    onClose={() => {
                        setShowBorrowDetailsModal(false);
                        setSelectedUserForDetails(null);
                    }}
                    user={selectedUserForDetails}
                    adminUser={adminUser} 
                />
            )}
        </div>
    );
}