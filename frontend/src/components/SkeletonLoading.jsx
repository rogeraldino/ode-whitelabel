import React from 'react';

const SkeletonLoading = () => {
  return (
    <div className="skeleton-container">
      {[1, 2, 3].map((item) => (
        <div key={item} className="skeleton-item">
          <div className="skeleton-icon"></div>
          <div className="skeleton-content">
            <div className="skeleton-title"></div>
            <div className="skeleton-meta">
              <div className="skeleton-tag"></div>
              <div className="skeleton-bncc"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SkeletonLoading; 