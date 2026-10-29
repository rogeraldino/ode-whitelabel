import React from 'react';
import '../style/ProgressBar.css';

const ProgressBar = ({ currentStep, totalSteps, primaryColor, stepProgress = 0 }) => {
  const progressPercentage = ((currentStep + 1) / totalSteps) * 100;

  return (
    <div className="progress-container">
      {/* Barra de progresso única e simples */}
      <div className="progress-bar-overall">
        <div 
          className="progress-fill"
          style={{
            width: `${progressPercentage}%`,
            backgroundColor: primaryColor
          }}
        />
      </div>
    </div>
  );
};

export default ProgressBar; 