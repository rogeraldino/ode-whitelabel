import React, { useEffect } from 'react';
import { X } from 'lucide-react';

const gerarIdAmigavel = (uuid) => {
  if (!uuid) return '';
  const shortId = uuid.substring(0, 8);
  const numericId = parseInt(shortId, 16) % 10000;
  return numericId;
};

export default function ReportModal({ show, questao, reportText, setReportText, onCancel, onSubmit, questaoIndex }) {
  useEffect(() => {
    if (show) document.body.classList.add('modal-open');
    else document.body.classList.remove('modal-open');
    return () => document.body.classList.remove('modal-open');
  }, [show]);

  if (!show) return null;

  const idAmigavel = gerarIdAmigavel(questao?.uuid);
  const numeroQuestao = questaoIndex !== undefined ? String(questaoIndex + 1).padStart(2, '0') : '';

  return (
      <div className="report-overlay">
        <div className="report-form-container">
          <div className="report-form-header">
            <div className="header-content">
              <h4 className="text-lg font-semibold">Erro na questão {numeroQuestao}</h4>
              <span className="questao-id">#{idAmigavel}</span>
            </div>
            <button className="btn-close-report" onClick={onCancel} title="Fechar"><X size={20} /></button>
          </div>
          <div className="report-form-body">
            <label htmlFor="reportText" className="form-label">Descreva o erro:</label>
            <textarea
                id="reportText"
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                className="report-textarea"
                rows="4"
                placeholder="Detalhes sobre o erro na questão..."
            />
          </div>
          <div className="report-actions modal-actions">
            <button className="btn-secondary" onClick={onCancel}>Cancelar</button>
            <button className="btn-primary" onClick={onSubmit} disabled={!reportText.trim()}>Enviar Relatório</button>
          </div>
        </div>
      </div>
  );
}
