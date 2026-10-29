import React from 'react';
import { FileText, Plus, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

const EmptyState = ({ 
  title = "Nenhuma atividade recente", 
  message = "Comece criando sua primeira lista de exercícios para ver suas atividades aqui.",
  buttonText = "Criar Primeira Atividade",
  buttonLink = "/gerar-atividades",
  isError = false
}) => {
  const Icon = isError ? RefreshCw : FileText;
  const ButtonIcon = isError ? RefreshCw : Plus;

  return (
    <div className="empty-state">
      <div className={`empty-state-icon ${isError ? 'empty-state-icon--error' : ''}`}>
        <Icon size={48} />
      </div>
      <div className="empty-state-content">
        <h4 className="empty-state-title">{title}</h4>
        <p className="empty-state-description">{message}</p>
        {isError ? (
          <button 
            onClick={() => window.location.reload()} 
            className="empty-state-button"
          >
            <ButtonIcon size={16} />
            {buttonText}
          </button>
        ) : (
          <Link to={buttonLink} className="empty-state-button">
            <ButtonIcon size={16} />
            {buttonText}
          </Link>
        )}
      </div>
    </div>
  );
};

export default EmptyState; 