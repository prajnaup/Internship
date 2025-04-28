// frontend/src/Home.js
import React from 'react';

export default function Home({ user, onLogout }) { // Accept onLogout prop
  return (
    <div className="home-container">
      <div className="card">
        <h1 className="title">Welcome Back!</h1>
        {user?.photo ? (
          <img src={user.photo} alt={user.name || 'User Avatar'} className="avatar" />
        ) : (
          <div className="avatar-placeholder">{user?.name ? user.name.charAt(0).toUpperCase() : '?'}</div>
        )}
        <h2 className="subtitle">{user?.name || 'Valued User'}</h2>
        <p className="email-text">{user?.email}</p>
        <p className="info-text">You're all set! Your phone number is {user?.phoneNumber || 'registered'}.</p>
        <button onClick={onLogout} className="logout-button">Log Out</button>
      </div>
    </div>
  );
}