import React from 'react';
import { X } from 'lucide-react';

export default function HabilidadeCard({ h, onRemove }) {
  return (
    <div className="habilidade-card" style={{position:'relative'}}>
      <div className="habilidade-card__codigo" style={{marginBottom: 8, position: 'relative'}}>
        {h.codigo_bncc}
        <button
          className="remove-habilidade-btn"
          title="Remover habilidade"
          onClick={() => onRemove(h)}
        >
          <X size={16} />
        </button>
      </div>
      <div className="habilidade-details" style={{marginTop:8}}>
        <div style={{marginBottom:8}}>
          <strong>Habilidade: </strong>
          <span>{h.habilidade_bncc || h.descricao}</span>
        </div>
        {h.unidades_tematicas && (
          <div style={{marginBottom:8}}>
            <strong>Unidade Temática: </strong>
            <span>{h.unidades_tematicas}</span>
          </div>
        )}
        {h.objetos_de_conhecimento && (
          <div>
            <strong>Objeto Conhecimento: </strong>
            <span>{h.objetos_de_conhecimento}</span>
          </div>
        )}
      </div>
    </div>
  );
} 