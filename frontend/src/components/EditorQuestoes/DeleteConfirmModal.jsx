import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export default function DeleteConfirmModal({ show, onCancel, onConfirm, questao }) {
  useEffect(() => {
    if (show) document.body.classList.add('modal-open');
    else document.body.classList.remove('modal-open');
    return () => document.body.classList.remove('modal-open');
  }, [show]);

  if (!show) return null;
  return (
      <div className="confirm-modal-overlay">
        <div className="confirm-modal-content">
          <div className="modal-header">
            <h3 className="text-lg font-semibold">Confirmar Exclusão</h3>
            <button className="btn-close-modal" onClick={onCancel} title="Fechar"><X size={20} /></button>
          </div>
          <div className="modal-body">
            <p>Tem certeza que deseja remover a questão:</p>
            <p className="questao-texto-modal">"{questao?.enunciado}"</p>
          </div>
          <div className="modal-actions">
            <button className="btn-secondary" onClick={onCancel}>Cancelar</button>
            <button className="btn-delete" onClick={onConfirm}>Excluir</button>
          </div>
        </div>
      </div>
  );
}
