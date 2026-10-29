// QuestoesControlPanel.jsx
import React, { useState } from 'react';
import { GripVertical, Plus } from 'lucide-react';

export default function QuestoesControlPanel({
                                                 questoes,
                                                 selectedIndex,
                                                 onSelectQuestion,
                                                 onMoveQuestion,
                                                 /** NOVO */
                                                 isMobile = false,
                                                 onGenerateMore = null,
                                             }) {
    const [draggedIndex, setDraggedIndex] = useState(null);
    const [dragOverIndex, setDragOverIndex] = useState(null);

    const getDifficultyColor = (dificuldade) => {
        switch (dificuldade?.toLowerCase()) {
            case 'fácil':
            case 'facil': return 'dificuldade-facil';
            case 'médio':
            case 'medio': return 'dificuldade-medio';
            case 'difícil':
            case 'dificil': return 'dificuldade-dificil';
            default: return 'dificuldade-default';
        }
    };

    const getDifficultyText = (dificuldade) => {
        switch (dificuldade?.toLowerCase()) {
            case 'fácil':
            case 'facil': return 'Fácil';
            case 'médio':
            case 'medio': return 'Médio';
            case 'difícil':
            case 'dificil': return 'Difícil';
            default: return 'Médio';
        }
    };

    const handleDragStart = (e, index) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.target.outerHTML);
    };
    const handleDragOver = (e, index) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverIndex(index); };
    const handleDrop = (e, index) => {
        e.preventDefault();
        if (draggedIndex !== null && draggedIndex !== index) {
            onMoveQuestion(draggedIndex, 'drop', index);
        }
        setDraggedIndex(null); setDragOverIndex(null);
    };
    const handleDragEnd = () => { setDraggedIndex(null); setDragOverIndex(null); };

    return (
        <div className="questoes-control-panel">
            <div className="control-panel-header">
                <div className="control-panel-title-row">
                    <h3 className="control-panel-title">Questões</h3>
                </div>
            </div>

            <div className="questoes-list">
                {questoes.length === 0 ? (
                    <div className="empty-questions"><p>Nenhuma questão disponível</p></div>
                ) : (
                    questoes.map((questao, index) => (
                        <div
                            key={questao.uuid}
                            className={`questao-item ${selectedIndex === index ? 'questao-item--selected' : ''} ${
                                draggedIndex === index ? 'questao-item--dragging' : ''
                            } ${dragOverIndex === index ? 'questao-item--drag-over' : ''}`}
                            onClick={() => onSelectQuestion(index)}
                            title={`Questão ${index + 1} - ${getDifficultyText(questao.dificuldade)}`}
                            draggable
                            onDragStart={(e) => handleDragStart(e, index)}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDrop={(e) => handleDrop(e, index)}
                            onDragEnd={handleDragEnd}
                        >
                            <div className="questao-item-header">
                                <div className="questao-number">{index + 1}</div>
                                <div className={`questao-difficulty ${getDifficultyColor(questao.dificuldade)}`}>
                                    {getDifficultyText(questao.dificuldade)}
                                </div>
                            </div>
                            <div className="questao-move-indicator"><GripVertical size={14} /></div>
                        </div>
                    ))
                )}
                {isMobile && onGenerateMore && (
                    <button
                        onClick={onGenerateMore}
                        className="ai-tool-card bg-blue-100 text-blue-600"
                        style={{ padding: '.5rem .75rem' }}
                    >
                        <div className="ai-tool-icon"><Plus className="w-5 h-5" /></div>
                        <div className="ai-tool-content">
                            <h4>Gerar 3 Questões</h4>
                            <p>Criar novas questões</p>
                        </div>
                    </button>
                )}
            </div>
        </div>
    );
}
