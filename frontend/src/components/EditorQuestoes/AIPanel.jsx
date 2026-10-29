// AIPanel.jsx
import React, { useState } from 'react';
import { Plus, Lightbulb, AlertTriangle, BookOpen } from 'lucide-react';
// ... imports de serviços mantidos
// (mantenha seus imports atuais)
import {
  simplificarQuestao,
  dificultarQuestao,
  contextualizarQuestao,
  gerarMaisQuestoesLLM,
  aguardarResultadoDaTask,
  buscarQuestoesDaLista,
} from '../../services/Api.jsx';

export default function AIPanel({
                                  onClose,
                                  isEditing,
                                  selectedQuestion,
                                  questoes,
                                  setQuestoesSelecionadas,
                                  listaUuid,
                                  startLoading,
                                  stopLoading,
                                  /** NOVO: permite passar o handler do pai */
                                  onRunTool,
                                  /** NOVO: ocultar painel no mobile (opcional) */
                                  hide = false,
                                }) {
  const [loadingTool, setLoadingTool] = useState(null);

  if (hide) return null;

  const aiTools = [
    { id: 'gerar-questoes', icon: <Plus className="w-5 h-5" />, title: 'Gerar 3 Questões', description: 'Criar novas questões sobre o tema', color: 'bg-blue-100 text-blue-600' },
    { id: 'simplificar',     icon: <Lightbulb className="w-5 h-5" />, title: 'Simplificar',       description: 'Tornar questão mais simples',        color: 'bg-yellow-100 text-yellow-600' },
    { id: 'mais-dificil',    icon: <AlertTriangle className="w-5 h-5" />, title: 'Mais Difícil',  description: 'Aumentar nível de dificuldade',      color: 'bg-red-100 text-red-600' },
    { id: 'contextualizar',  icon: <BookOpen className="w-5 h-5" />, title: 'Contextualizar',     description: 'Adicionar contexto real',            color: 'bg-blue-100 text-blue-600' }
  ];

  // ===== handler interno (compat), usado se onRunTool não vier do pai =====
  const handleToolClickInternal = async (toolId) => {
    setLoadingTool(toolId);
    startLoading && startLoading(toolId);
    try {
      if (toolId === 'gerar-questoes') {
        if ((questoes?.length || 0) >= 15) return;
        const task = await gerarMaisQuestoesLLM({ lista_uuid: listaUuid });
        await aguardarResultadoDaTask(task.task_id);
        const data = await buscarQuestoesDaLista(listaUuid);
        const todas = Array.isArray(data?.questoes) ? data.questoes : Array.isArray(data) ? data : [];
        setQuestoesSelecionadas(prev => {
          const prevSet = new Set((prev || []).map(q => q.uuid));
          const novas = todas.filter(q => !prevSet.has(q.uuid));
          return [...(prev || []), ...novas];
        });
      } else if (isEditing && selectedQuestion) {
        let task = null;
        if (toolId === 'simplificar')   task = await simplificarQuestao(selectedQuestion);
        if (toolId === 'mais-dificil')  task = await dificultarQuestao(selectedQuestion);
        if (toolId === 'contextualizar') task = await contextualizarQuestao(selectedQuestion);
        if (task?.task_id) {
          const resultado = await aguardarResultadoDaTask(task.task_id);
          const payload = resultado?.dados ?? resultado;
          const formatada = converterQuestaoLLM(payload);
          if (!formatada) return;
          const safe = Object.fromEntries(Object.entries(formatada).filter(([,v]) => v !== undefined));
          setQuestoesSelecionadas(prev => prev.map(q => q.uuid === selectedQuestion.uuid ? ({ ...q, ...safe }) : q));
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingTool(null);
      stopLoading && stopLoading();
    }
  };

  const handleToolClick = (toolId) => {
    if (onRunTool) return onRunTool(toolId);
    return handleToolClickInternal(toolId);
  };

  // ... manter converterQuestaoLLM igual ao seu arquivo original
  const converterQuestaoLLM = (dados) => {
    if (!dados) return null;
    if (dados.uuid) return dados;
    if (!dados.q && typeof dados === 'object') {
      const vals = Object.values(dados);
      if (vals.length === 1 && vals[0]?.q) dados = vals[0];
    }
    const base = {
      enunciado: dados.q,
      solucao: dados.solucao,
      bncc: dados.bncc,
      habilidade_id: dados.habilidade_id,
      tipo: Array.isArray(dados.a) ? 'objetiva' : 'discursiva',
    };
    if (Array.isArray(dados.a)) {
      const c = dados.c;
      const isLetter = typeof c === 'string' && /^[A-E]$/i.test(c?.trim?.());
      base.alternativas = dados.a.map((texto, idx) => {
        const letra = String.fromCharCode(65 + idx);
        const correta = isLetter ? letra.toUpperCase() === c.toUpperCase() : texto === c;
        return { id: idx + 1, letra, texto, correta, imagem: null };
      });
    }
    if (dados.r) base.resposta_discursiva = dados.r;
    return base;
  };

  return (
      <div className={`ai-panel ${isEditing ? 'ai-panel-active' : 'ai-panel-inactive'}`}>
        <div className="ai-panel-header">
          <div className="ai-panel-title">
            <h2>Ferramentas de IA</h2>
            <p>{isEditing ? 'Personalize a questão selecionada' : 'Crie e melhore questões com inteligência artificial'}</p>
          </div>
        </div>

        <div className="ai-section">
          {!isEditing && (
              <div className="ai-info-message">
                <p>Clique em "Editar" em uma questão para ativar as ferramentas de personalização</p>
              </div>
          )}
          <div className="ai-tools-grid">
            {aiTools.map((tool) => {
              const isDisabled = (tool.id !== 'gerar-questoes' && !isEditing) || !!loadingTool;
              return (
                  <button
                      key={tool.id}
                      onClick={() => handleToolClick(tool.id)}
                      className={`ai-tool-card ${tool.color} ${isDisabled ? 'ai-tool-disabled' : ''}`}
                      disabled={isDisabled}
                  >
                    <div className="ai-tool-icon">{tool.icon}</div>
                    <div className="ai-tool-content">
                      <h4>{tool.title}</h4>
                      <p>{tool.description}</p>
                    </div>
                  </button>
              );
            })}
          </div>
        </div>
      </div>
  );
}
