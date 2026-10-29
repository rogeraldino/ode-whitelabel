import React from 'react';
import { Trash2, AlertCircle, Save, X, Edit3 } from 'lucide-react';

export default function QuestaoCardSelecionada({
                                                 questao,
                                                 index,
                                                 draggedIndex,
                                                 dragOverIndex,
                                                 onDragStart,
                                                 onDragOver,
                                                 onDrop,
                                                 onDragEnd,
                                                 onEdit,
                                                 onDelete,
                                                 onReport,
                                                 editing,
                                                 editContent,
                                                 setEditContent,
                                                 editAlternativas,
                                                 setEditAlternativas,
                                                 editResposta,
                                                 setEditResposta,
                                                 onSaveEdit,
                                                 onPesoChange,
                                                 isHighlighted
                                               }) {
  return (
      <div
          className={`questao-selecionada ${draggedIndex === index ? 'dragging' : ''} ${dragOverIndex === index ? 'drag-over' : ''} ${isHighlighted ? 'highlighted' : ''} ${editing ? 'editing-mode' : ''}`}
          draggable
          onDragStart={(e) => { onDragStart(e, index); e.dataTransfer.setData('text/plain', String(questao.uuid)); }}
          onDragOver={onDragOver}
          onDrop={(e) => onDrop(e, index)}
          onDragEnd={onDragEnd}
      >
        <div className="questao-header">
          <div className="questao-numero">{index + 1}</div>
          <div className="questao-acoes">
            {editing ? (
                <>
                  <button className="btn-icon btn-save" onClick={() => onSaveEdit(questao.uuid)}><Save size={18} /></button>
                  <button className="btn-icon btn-cancel" onClick={() => onEdit(null)}><X size={18} /></button>
                </>
            ) : (
                <>
                  <button className="btn-icon btn-edit" onClick={() => onEdit(questao.uuid)} title="Editar"><Edit3 size={18} /></button>
                  <button className="btn-icon btn-info" onClick={() => onReport(questao)} title="Reportar"><AlertCircle size={18} /></button>
                  <button className="btn-icon btn-delete" onClick={() => onDelete(questao)} title="Excluir"><Trash2 size={18} /></button>
                </>
            )}
          </div>
        </div>
        <div className="questao-body">
          {editing ? (
              <div>
            <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="form-textarea"
                rows={2}
                placeholder="Edite o enunciado da questão..."
            />
                {questao.tipo === 'objetiva' && (
                    <div className="alternativas-container mt-2">
                      <label className="form-label">Alternativas</label>
                      {editAlternativas.map((alt, idx) => (
                          <div key={alt.id} className="alternativa-item">
                            <div className="flex items-center gap-2">
                              <span className="font-bold bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                                {alt.letra}
                              </span>
                              <input
                                  type="radio"
                                  name={`correta-${questao.uuid}`}
                                  checked={alt.correta}
                                  onChange={() =>
                                      setEditAlternativas((prev) => prev.map((a, i) => ({ ...a, correta: i === idx })))
                                  }
                                  className="radio-input"
                              />
                              <input
                                  type="text"
                                  value={alt.texto}
                                  onChange={(e) =>
                                      setEditAlternativas((prev) => prev.map((a, i) => (i === idx ? { ...a, texto: e.target.value } : a)))
                                  }
                                  className="alternativa-input"
                                  placeholder={`Digite a alternativa ${alt.letra}...`}
                              />
                            </div>
                          </div>
                      ))}
                    </div>
                )}
                {questao.tipo === 'discursiva' && (
                    <div className="resposta-discursiva-editor mt-2">
                      <label className="form-label">Resposta esperada</label>
                      <textarea
                          value={editResposta}
                          onChange={(e) => setEditResposta(e.target.value)}
                          className="form-textarea"
                          rows={1}
                          placeholder="Edite a resposta esperada..."
                      />
                    </div>
                )}
              </div>
          ) : (
              <div>
                <p className="questao-texto">{questao.enunciado}</p>
                {questao.tipo === 'objetiva' && Array.isArray(questao.alternativas) && (
                    <div className="alternativas-view mt-2">
                      {questao.alternativas.map((alt) => (
                          <div
                              key={alt.id}
                              className={`alternativa-item-view flex items-start gap-2 mb-1 ${alt.correta ? 'bg-green-50 border-l-4 border-green-500 pl-2' : ''}`}
                          >
                            <span className={`font-bold ${alt.correta ? 'text-green-600' : ''}`}>{alt.letra}</span>
                            <span className={alt.correta ? 'text-green-700 font-medium' : ''}>{alt.texto}</span>
                            {alt.correta && <span className="text-green-600 font-bold text-sm ml-2">✓</span>}
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
                {questao.editada && <span className="editado-badge">Editada</span>}
              </div>
          )}
        </div>
      </div>
  );
}
