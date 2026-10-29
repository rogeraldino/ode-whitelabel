import React, { useState } from 'react';
import { Download, X } from 'lucide-react';

export default function ExportModal({ isOpen, onClose, onExport, isExporting }) {
  const [format, setFormat] = useState('docx');
  const [includeAnswerKey, setIncludeAnswerKey] = useState(false);

  const handleExport = () => {
    onExport(format, {
      includeAnswerKey
    });
  };

  if (!isOpen) return null;

  return (
    <div className="export-modal-overlay">
      <div className="export-modal">
        <div className="export-modal-header">
          <h2>Exportar Lista</h2>
          <button className="export-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        
        <div className="export-modal-content">
          <div className="export-format-section">
            <label className="export-label">Formato:</label>
            <div className="export-format-options">
              <button 
                className={`format-option ${format === 'docx' ? 'active' : ''}`}
                onClick={() => setFormat('docx')}
              >
                Word (DOCX)
              </button>
              <button 
                className={`format-option ${format === 'pdf' ? 'active' : ''}`}
                onClick={() => setFormat('pdf')}
              >
                PDF
              </button>
            </div>
          </div>

          <div className="export-options-section">
            <label className="export-label">Opções de exportação:</label>
            <div className="export-checkboxes">
              <label className="export-checkbox">
                <input 
                  type="checkbox" 
                  checked={includeAnswerKey}
                  onChange={(e) => setIncludeAnswerKey(e.target.checked)}
                />
                <span>Incluir gabarito ao final</span>
              </label>
            </div>
          </div>
        </div>

        <div className="export-modal-footer">
          <button className="btn-cancel" onClick={onClose}>
            Cancelar
          </button>
          <button 
            className="btn-export-confirm" 
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? (
              <Download className="animate-spin" size={16} />
            ) : (
              <Download size={16} />
            )}
            <span>Baixar como {format.toUpperCase()}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
