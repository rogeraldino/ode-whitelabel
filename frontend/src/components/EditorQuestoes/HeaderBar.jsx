import React from 'react';
import { Download, Sparkles } from 'lucide-react';

export default function HeaderBar({ onExport, isExporting }) {
  return (
    <div className="header-bar">
      <div className="header-left">
        <span className="brand-badge">
          <Sparkles size={20} color="#fff" />
        </span>
        <h1 className="header-title">Edição da Lista</h1>
      </div>
      <div className="header-right">
        <div className="header-actions">
          <button className="btn-export" onClick={onExport} disabled={isExporting}>
            {isExporting ? <Download className="animate-spin" size={20} /> : <Download size={20} />}
            <span>Exportar</span>
          </button>
        </div>
      </div>
    </div>
  );
}
