// EditorQuestoes.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import '../style/editorQuestoes.css';

import HeaderBar from '../components/EditorQuestoes/HeaderBar.jsx';
import ExportModal from '../components/EditorQuestoes/ExportModal.jsx';
import QuestaoCardSelecionada from '../components/EditorQuestoes/QuestaoCardSelecionada.jsx';
import DeleteConfirmModal from '../components/EditorQuestoes/DeleteConfirmModal.jsx';
import ReportModal from '../components/EditorQuestoes/ReportModal.jsx';
import FeedbackToast from '../components/EditorQuestoes/FeedbackToast.jsx';
import LoadingOverlay from '../components/EditorQuestoes/LoadingOverlay.jsx';
import LoadingScreen from '../components/LoadingScreen.jsx';
import AIPanel from '../components/EditorQuestoes/AIPanel.jsx';
import QuestoesControlPanel from '../components/EditorQuestoes/QuestoesControlPanel.jsx';
import useEditorQuestoes from '../hooks/useEditorQuestoes.js';

// IMPORTS DE SERVIÇO (para rodar IA daqui)
import {
  simplificarQuestao,
  dificultarQuestao,
  contextualizarQuestao,
  gerarMaisQuestoesLLM,
  aguardarResultadoDaTask,
  buscarQuestoesDaLista,
} from '../services/Api.jsx';

// pequeno controle inline para mobile
import { Lightbulb, AlertTriangle, BookOpen } from 'lucide-react';

function MobileAIControls({ onRunTool }) {
  return (
      <div className="mobile-ai-controls">
        <div className="ai-tools-grid">
          <button className="ai-tool-card bg-yellow-100 text-yellow-600" onClick={() => onRunTool('simplificar')}>
            <h4>Simplificar</h4>
          </button>
          <button className="ai-tool-card bg-red-100 text-red-600" onClick={() => onRunTool('mais-dificil')}>
            <h4>Dificultar</h4>
          </button>
          <button className="ai-tool-card bg-blue-100 text-blue-600" onClick={() => onRunTool('contextualizar')}>
            <h4>Contexto</h4>
          </button>
        </div>
      </div>
  );
}

export default function EditorQuestoes() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const listaUuid = (location.state && location.state.listaUuid) || params.uuid;

  const {
    questoesSelecionadas,
    loading,
    error,
    isSavingList,
    isDownloading,
    isDownloadingDocx,
    isLoading,
    removerQuestao,
    salvarLista,
    baixarPDF,
    baixarDOCX,
    salvarEdicao,
    setQuestoesSelecionadas
  } = useEditorQuestoes(listaUuid);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [questaoToDelete, setQuestaoToDelete] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState(null);
  const [reportingQuestion, setReportingQuestion] = useState(null);
  const [reportText, setReportText] = useState('');
  const [editandoId, setEditandoId] = useState(null);
  const [editandoTexto, setEditandoTexto] = useState('');
  const [editandoAlternativas, setEditandoAlternativas] = useState([]);
  const [editandoRespostaDiscursiva, setEditandoRespostaDiscursiva] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0);
  const questoesContainerRef = useRef(null);
  const [aiLoadingMessage, setAiLoadingMessage] = useState(null);
  const [aiLoadingType, setAiLoadingType] = useState(null);

  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // === NOVO: detectar mobile
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  useEffect(() => { setIsSaved(false); }, [questoesSelecionadas]);

  useEffect(() => {
    if (!editandoId) return;
    const q = questoesSelecionadas.find(q => q.uuid === editandoId);
    if (!q) return;
    setEditandoTexto(q.enunciado || '');
    if (q.tipo === 'objetiva' && Array.isArray(q.alternativas)) {
      setEditandoAlternativas(q.alternativas.map(a => ({ ...a })));
      setEditandoRespostaDiscursiva('');
    } else if (q.tipo === 'discursiva') {
      setEditandoRespostaDiscursiva(q.resposta_discursiva || '');
      setEditandoAlternativas([]);
    }
  }, [questoesSelecionadas, editandoId]);

  const showFeedback = (message, type = 'success') => {
    setFeedbackMessage({ message, type });
    setTimeout(() => setFeedbackMessage(null), 4500);
  };

  const handleRequestDelete = (q) => { setQuestaoToDelete(q); setShowDeleteConfirm(true); };
  const handleConfirmDelete = () => { if (questaoToDelete) { removerQuestao(questaoToDelete.uuid); setShowDeleteConfirm(false); setQuestaoToDelete(null); showFeedback('Questão removida.'); } };

  const handleSelectQuestion = (index) => {
    setSelectedQuestionIndex(index);
    if (questoesContainerRef.current) {
      const questionElements = questoesContainerRef.current.querySelectorAll('.questao-selecionada');
      if (questionElements[index]) {
        questionElements[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  const handleMoveQuestion = (fromIndex, direction, toIndex = null) => {
    if (direction === 'drop' && toIndex !== null) {
      const newQuestoes = [...questoesSelecionadas];
      const draggedQuestao = newQuestoes[fromIndex];
      newQuestoes.splice(fromIndex, 1);
      newQuestoes.splice(toIndex, 0, draggedQuestao);
      setQuestoesSelecionadas(newQuestoes);
      setSelectedQuestionIndex(toIndex);
    } else if (direction === 'up' && fromIndex > 0) {
      const newQuestoes = [...questoesSelecionadas];
      [newQuestoes[fromIndex], newQuestoes[fromIndex - 1]] = [newQuestoes[fromIndex - 1], newQuestoes[fromIndex]];
      setQuestoesSelecionadas(newQuestoes);
      setSelectedQuestionIndex(fromIndex - 1);
    } else if (direction === 'down' && fromIndex < questoesSelecionadas.length - 1) {
      const newQuestoes = [...questoesSelecionadas];
      [newQuestoes[fromIndex], newQuestoes[fromIndex + 1]] = [newQuestoes[fromIndex + 1], newQuestoes[fromIndex]];
      setQuestoesSelecionadas(newQuestoes);
      setSelectedQuestionIndex(fromIndex + 1);
    }
  };

  const enviarReport = () => { showFeedback('Relatório de erro enviado com sucesso!', 'success'); setReportingQuestion(null); setReportText(''); };

  const handleSaveList = async () => {
    if (questoesSelecionadas.length < 5) {
      showFeedback('Adicione pelo menos 5 questões para salvar a lista.', 'error');
    } else {
      await salvarLista();
      setIsSaved(true);
      showFeedback('Lista salva com sucesso! Download disponível.');
    }
  };

  const handleExport = () => {
    setShowExportModal(true);
  };

  const handleExportConfirm = async (format, options) => {
    if (questoesSelecionadas.length < 5) {
      showFeedback('Adicione pelo menos 5 questões para exportar a lista.', 'error');
      return;
    }

    setIsExporting(true);
    
    try {
      // Salvar automaticamente antes de exportar
      await salvarLista();
      setIsSaved(true);
      
      // Exportar no formato selecionado
      if (format === 'pdf') {
        await baixarPDF();
      } else {
        await baixarDOCX();
      }
      
      // Mostrar notificação de sucesso com delay para dar tempo do download iniciar
      setTimeout(() => {
        showFeedback(`Lista exportada como ${format.toUpperCase()} com sucesso!`, 'success');
      }, 1000);
      
      setShowExportModal(false);
    } catch (error) {
      showFeedback('❌ Erro ao exportar a lista. Tente novamente.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadList = () => { if (questoesSelecionadas.length < 5) showFeedback('Adicione pelo menos 5 questões para baixar a lista.', 'error'); else baixarPDF(); };
  const handleDownloadDocxList = () => { if (questoesSelecionadas.length < 5) showFeedback('Adicione pelo menos 5 questões para baixar a lista.', 'error'); else baixarDOCX(); };

  const salvarEdicaoQuestao = (id) => {
    const questao = questoesSelecionadas.find((q) => q.uuid === id);
    const dados = { enunciado: editandoTexto };
    if (questao.tipo === 'objetiva') {
      dados.alternativas = editandoAlternativas.map((alt) => ({
        id: alt.id, letra: alt.letra, texto: alt.texto, correta: alt.correta, imagem: alt.imagem || null,
      }));
    }
    if (questao.tipo === 'discursiva') {
      dados.resposta_discursiva = editandoRespostaDiscursiva;
    }
    salvarEdicao(id, dados);
    setEditandoId(null);
    setEditandoTexto('');
    setEditandoAlternativas([]);
    setEditandoRespostaDiscursiva('');
    showFeedback('Questão atualizada com sucesso!');
  };

  const startAiLoading = (toolId) => { setAiLoadingType(toolId); setAiLoadingMessage(true); };
  const stopAiLoading = () => { setAiLoadingType(null); setAiLoadingMessage(null); };

  // ========= NOVO: lógica centralizada das ferramentas de IA =========
  const runAiTool = async (toolId) => {
    startAiLoading(toolId);
    try {
      if (toolId === 'gerar-questoes') {
        if ((questoesSelecionadas?.length || 0) >= 15) return;
        const task = await gerarMaisQuestoesLLM({ lista_uuid: listaUuid });
        await aguardarResultadoDaTask(task.task_id);
        const data = await buscarQuestoesDaLista(listaUuid);
        const todas = Array.isArray(data?.questoes) ? data.questoes : Array.isArray(data) ? data : [];
        setQuestoesSelecionadas(prev => {
          const prevSet = new Set((prev || []).map(q => q.uuid));
          const novas = todas.filter(q => !prevSet.has(q.uuid));
          return [...(prev || []), ...novas];
        });
        return;
      }

      // demais ações exigem questão selecionada em edição
      const selectedQuestion = questoesSelecionadas.find(q => q.uuid === editandoId);
      if (!selectedQuestion) return;

      let task = null;
      if (toolId === 'simplificar')   task = await simplificarQuestao(selectedQuestion);
      if (toolId === 'mais-dificil')  task = await dificultarQuestao(selectedQuestion);
      if (toolId === 'contextualizar') task = await contextualizarQuestao(selectedQuestion);

      if (task?.task_id) {
        const resultado = await aguardarResultadoDaTask(task.task_id);
        const payload = resultado?.dados ?? resultado;

        const converter = (dados) => {
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

        const formatada = converter(payload);
        if (!formatada) return;
        const safe = Object.fromEntries(Object.entries(formatada).filter(([,v]) => v !== undefined));
        setQuestoesSelecionadas(prev => prev.map(q => q.uuid === selectedQuestion.uuid ? ({ ...q, ...safe }) : q));
      }
    } catch (e) {
      console.error('Erro ao usar ferramenta de IA:', e);
    } finally {
      stopAiLoading();
    }
  };

  if (loading) return <div className="min-h-screen bg-gray-50 p-6 flex justify-center items-center">Carregando questões...</div>;
  if (error)   return <div className="min-h-screen bg-gray-50 p-6 flex justify-center items-center text-red-500">{error}</div>;

  return (
      <div className="editor-questoes min-h-screen bg-gray-50">
        <LoadingOverlay show={isLoading} message="Processando..." />
        <LoadingScreen
            isVisible={!!aiLoadingMessage}
            title={aiLoadingType === 'gerar-questoes' ? "Gerando novas questões" :
                aiLoadingType === 'simplificar' ? "Simplificando questão" :
                    aiLoadingType === 'mais-dificil' ? "Elevando o nível de complexidade" :
                        aiLoadingType === 'contextualizar' ? "Adicionando contexto real à questão" : "Processando..."}
            subtitle={aiLoadingType === 'gerar-questoes' ? "Aguarde enquanto criamos questões personalizadas..." :
                aiLoadingType === 'simplificar' ? "Tornando a questão mais acessível..." :
                    aiLoadingType === 'mais-dificil' ? "Elevando o nível de complexidade..." :
                        aiLoadingType === 'contextualizar' ? "Adicionando contexto real à questão..." : "Aguarde..."}
            primaryColor={aiLoadingType === 'gerar-questoes' ? "#3B82F6" :
                aiLoadingType === 'simplificar' ? "#F59E0B" :
                    aiLoadingType === 'mais-dificil' ? "#EF4444" :
                        aiLoadingType === 'contextualizar' ? "#8B5CF6" : "#7C3AED"}
            icon={aiLoadingType === 'gerar-questoes' ? "Plus" :
                aiLoadingType === 'simplificar' ? "Lightbulb" :
                    aiLoadingType === 'mais-dificil' ? "AlertTriangle" :
                        aiLoadingType === 'contextualizar' ? "BookOpen" : "BookOpen"}
            estimatedDuration={8000}
            adaptiveMode={true}
            steps={[]}
        />

        <FeedbackToast message={feedbackMessage} />
        <HeaderBar
            onExport={handleExport}
            isExporting={isExporting}
        />

        <div className="main-content-editor">
          <QuestoesControlPanel
              questoes={questoesSelecionadas}
              selectedIndex={selectedQuestionIndex}
              onSelectQuestion={handleSelectQuestion}
              onMoveQuestion={handleMoveQuestion}
              /* NOVO */
              isMobile={isMobile}
              onGenerateMore={() => runAiTool('gerar-questoes')}
          />

          <div className="questoes-container" ref={questoesContainerRef}>
            {questoesSelecionadas.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">+</div>
                  <p className="text-gray-500">Nenhuma questão encontrada nesta lista.</p>
                </div>
            ) : (
                <div className={`questoes-selecionadas ${editandoId ? 'editing-active' : ''}`}>
                  {questoesSelecionadas.map((q, index) => (
                      <React.Fragment key={q.uuid}>
                        <QuestaoCardSelecionada
                            questao={q}
                            index={index}
                            draggedIndex={draggedIndex}
                            dragOverIndex={dragOverIndex}
                            onDragStart={() => setDraggedIndex(index)}
                            onDragOver={() => setDragOverIndex(index)}
                            onDrop={() => {
                              if (draggedIndex !== null && dragOverIndex !== null) {
                                handleMoveQuestion(draggedIndex, 'drop', dragOverIndex);
                                setDraggedIndex(null);
                                setDragOverIndex(null);
                              }
                            }}
                            onDragEnd={() => { setDraggedIndex(null); setDragOverIndex(null); }}
                            onEdit={(id) => {
                              setEditandoId(id);
                              setEditandoTexto(q.enunciado);
                              setEditandoAlternativas(q.tipo === 'objetiva' ? q.alternativas.map((a) => ({ ...a })) : []);
                              setEditandoRespostaDiscursiva(q.tipo === 'discursiva' ? q.resposta_discursiva || '' : '');
                            }}
                            onDelete={handleRequestDelete}
                            onReport={(questao) => {
                              const i = questoesSelecionadas.findIndex(x => x.uuid === questao.uuid);
                              setReportingQuestion({ questao, index: i });
                            }}
                            editing={editandoId === q.uuid}
                            editContent={editandoTexto}
                            setEditContent={setEditandoTexto}
                            editAlternativas={editandoAlternativas}
                            setEditAlternativas={setEditandoAlternativas}
                            editResposta={editandoRespostaDiscursiva}
                            setEditResposta={setEditandoRespostaDiscursiva}
                            onSaveEdit={salvarEdicaoQuestao}
                            isHighlighted={selectedQuestionIndex === index}
                        />

                        {/* NOVO: controles de IA inline apenas no mobile e somente para a questão em edição */}
                        {isMobile && editandoId === q.uuid && (
                            <MobileAIControls onRunTool={runAiTool} />
                        )}
                      </React.Fragment>
                  ))}
                </div>
            )}
          </div>

          {/* Painel de IA some no mobile; no desktop continua igual */}
          <AIPanel
              onClose={() => {}}
              isEditing={!!editandoId}
              selectedQuestion={editandoId ? questoesSelecionadas.find(q => q.uuid === editandoId) : null}
              questoes={questoesSelecionadas}
              setQuestoesSelecionadas={setQuestoesSelecionadas}
              listaUuid={listaUuid}
              startLoading={startAiLoading}
              stopLoading={stopAiLoading}
              /* NOVO */
              onRunTool={runAiTool}
              hide={isMobile}
          />
        </div>

        <ReportModal
            show={!!reportingQuestion}
            questao={reportingQuestion?.questao}
            reportText={reportText}
            setReportText={setReportText}
            onCancel={() => setReportingQuestion(null)}
            onSubmit={() => enviarReport(reportingQuestion?.questao?.uuid)}
            questaoIndex={reportingQuestion?.index}
        />
        <DeleteConfirmModal
            show={showDeleteConfirm}
            questao={questaoToDelete}
            onCancel={() => setShowDeleteConfirm(false)}
            onConfirm={handleConfirmDelete}
        />
        <ExportModal
            isOpen={showExportModal}
            onClose={() => setShowExportModal(false)}
            onExport={handleExportConfirm}
            isExporting={isExporting}
        />
      </div>
  );
}
