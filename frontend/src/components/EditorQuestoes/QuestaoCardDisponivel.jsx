import React from 'react';
import { PlusCircle } from 'lucide-react';

export default function QuestaoCardDisponivel({ questao, onAdd, highlight }) {
    return (
        <div className={`questao-card${highlight ? ' questao-card-highlight' : ''}`} onClick={() => onAdd(questao)}>
            <div className="questao-content">
                <p className="questao-texto">{questao.enunciado}</p>
                {questao.tipo === 'objetiva' && Array.isArray(questao.alternativas) && (
                    <div className="alternativas-view mt-2">
                        {questao.alternativas.map((alt) => (
                            <div
                                key={alt.id}
                                className={`alternativa-item-view flex items-start gap-2 mb-1 ${alt.correta ? 'bg-green-50 border-l-4 border-green-500 pl-2' : ''}`}
                            >
                                <span className="font-bold">{alt.letra})</span>
                                <span>{alt.texto}</span>
                            </div>
                        ))}
                    </div>
                )}
                {questao.tipo === 'discursiva' && questao.resposta_discursiva && (
                    <div className="resposta-discursiva-view mt-2 p-2 bg-gray-50 border border-gray-200 rounded">
                        <p className="text-sm text-gray-600">
                            <span className="font-semibold">Resposta esperada:</span> {questao.resposta_discursiva}
                        </p>
                    </div>
                )}
                <div className="questao-meta">
                    <span className={`tipo-badge ${questao.tipo}`}>{questao.tipo}</span>
                    <span className={questao.dificuldade && 'dificuldade-tag'}>{questao.dificuldade}</span>
                </div>
            </div>
            <button className="btn-add-questao" aria-label="Adicionar" onClick={(e) => { e.stopPropagation(); onAdd(questao); }}>
                <PlusCircle size={20} />
            </button>
        </div>
    );
}
