import React from 'react';

export default function FeedbackToast({ message }) {
  if (!message) return null;
  return (
      <div className={`feedback-toast ${message.type}`} key={`${message.message}-${message.type}`}>
        {message.message}
      </div>
  );
}
