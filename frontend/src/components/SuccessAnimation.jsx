import React, { useEffect, useState } from 'react';
import { CheckCircle, Download, FileText, X, Lightbulb } from 'lucide-react';
// import ConfettiAnimation from './ConfettiAnimation';
import '../style/SuccessAnimation.css';

const SuccessAnimation = ({ isVisible, onClose, fileName, title = "Plano de Aula Gerado!" }) => {
  const [showAnimation, setShowAnimation] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setShowAnimation(true);
      const timer = setTimeout(() => {
        setShowAnimation(false);
        setTimeout(() => {
          onClose && onClose();
        }, 300);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  return (
    <div className="success-overlay">
      {/* <ConfettiAnimation isActive={showAnimation} /> */}
      <div className={`success-container ${showAnimation ? 'show' : ''}`}>
        <button
          className="success-close-btn"
          aria-label="Fechar"
          onClick={() => onClose && onClose()}
        >
          <X size={24} />
        </button>
        <div className="success-icon">
          <CheckCircle size={40} color="#10B981" />
        </div>
        <h2 className="success-title">{title}</h2>
        <p className="success-message">
          Seu plano de aula foi criado com sucesso e está sendo baixado automaticamente.
        </p>
        
        <div className="file-info">
          <div className="file-icon">
            <FileText size={20} color="#7C3AED" />
          </div>
          <div className="file-details">
            <span className="file-name">{fileName || 'plano_de_aula.docx'}</span>
            <span className="file-size">Documento Word</span>
          </div>
        </div>

        <div className="success-actions">
          <div className="action-item">
            <Download size={14} color="#6B7280" />
            <span>Download automático iniciado</span>
          </div>
        </div>

        <div className="success-tips">
          <div className="tip-content">
            <Lightbulb size={16} color="#6B7280" />
            <span>Dica: Verifique sua pasta de downloads para encontrar o arquivo</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuccessAnimation; 