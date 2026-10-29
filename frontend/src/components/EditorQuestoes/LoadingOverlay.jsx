import React from 'react';
import './LoadingOverlay.css';

export default function LoadingOverlay({ show, message = 'Processando...' }) {
  if (!show) return null;
  return (
    <div className="loading-overlay">
      <div className="loader-container">
        <div className="loader-bar">
          <div className="loader-bar-fill" />
        </div>
        {message && (
          <div className="loader-text-container">
            <p className="loader-text">{message}</p>
          </div>
        )}
      </div>
    </div>
  );
}
