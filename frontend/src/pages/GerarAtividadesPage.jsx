// GerarAtividadesPage.jsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Info, Sparkles, BookOpen, Target, Lightbulb, Users } from 'lucide-react';
import '../style/gerarAtividades.css';
import { buscarHabilidades, enviarDadosLista, listarComponentes, listarAnosEscolares } from '../services/Api.jsx';
import { useAuth } from '../hooks/useAuth.jsx';
import FeedbackToast from '../components/EditorQuestoes/FeedbackToast.jsx';
import Select from 'react-select';
import HabilidadeCard from '../components/HabilidadeCard';
import TutorialButton from '../components/TutorialButton';
import TutorialModal from '../components/TutorialModal';
import LoadingScreen from '../components/LoadingScreen';

// Componente para cards de modo de geração
const ModoCard = ({ isSelected, onClick, icon, title, description, className }) => (
  <button
    type="button"
    role="radio"
    aria-checked={isSelected}
    className={`modo-card ${className} ${isSelected ? 'is-selected' : ''}`}
    onClick={onClick}
  >
    <div className="modo-card__icon">{icon}</div>
    <div className="modo-card__content">
      <h4 className="modo-card__title">{title}</h4>
      <p className="modo-card__desc">{description}</p>
    </div>
  </button>
);

export default function GerarAtividades() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkIsMobile = () => setIsMobile(window.innerWidth <= 768);
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  if (user && !user.funcionalidades?.includes('gerar-atividade')) {
    return <div className="p-4 text-center text-gray-500">Funcionalidade não disponível para seu perfil.</div>;
  }

  const loadingSteps = useMemo(() => [
    'Gerando questões...', 'Adicionando respostas...', 'Conferindo correção...', 'Criando PDF...', 'Gerando QR Code de correção...'
  ], []);
  const [currentStep, setCurrentStep] = useState(0);
  const [showLoader, setShowLoader] = useState(false);
  const [habilidades, setHabilidades] = useState([]);
  const [componentes, setComponentes] = useState([]);
  const [anosEscolares, setAnosEscolares] = useState([]);
  const [feedbackMessage, setFeedbackMessage] = useState(null);
  const [formData, setFormData] = useState({
    nomeLista: '',
    habilidade: [],
    anoEscolar: '',
    numQuestoes: '',
    dificuldade: 2,
    tipos: { objetiva: false, discursiva: false },
    idUsuario: user?.uuid,
    componente: '',
    modoTemaLivre: false,
    temaLivre: '',
    habilidadeInput: '',
    showHabilidadeSuggestions: false,
    highlightedSuggestion: -1,
    showFullList: false,
  });

  const [errors, setErrors] = useState({});
  const [tocado, setTocado] = useState({});
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const tutorialUrl = "https://www.youtube.com/embed/j-IPC3Os1FU?si=nScevufRJiUZONvG";
  const youtubeUrl = "https://www.youtube.com/watch?v=j-IPC3Os1FU";
  const [isFirstAccess, setIsFirstAccess] = useState(false);

  useEffect(() => {
    const hasSeenTour = localStorage.getItem('tourCompleted');
    if (!hasSeenTour) {
      setIsFirstAccess(true);
    } else {
      setIsFirstAccess(false);
    }
  }, []);

  useEffect(() => {
    const loadDados = async () => {
      try {
        const comps = await listarComponentes();
        setComponentes(comps.map(c => ({ value: c.nome, label: c.nome })));
        const anos = await listarAnosEscolares();
        setAnosEscolares(anos);
      } catch (err) {
        console.error('Erro ao carregar dados iniciais', err);
      }
    };
    loadDados();
  }, []);



  React.useEffect(() => {
    let interval;
    if (showLoader) interval = setInterval(() => setCurrentStep(s => (s + 1) % loadingSteps.length), 3000);
    else clearInterval(interval);
    return () => clearInterval(interval);
  }, [showLoader, loadingSteps]);

  const showFeedback = useCallback((message, type = 'success') => {
    console.log('Feedback Toast:', { message, type });
    setFeedbackMessage({ message, type });
    const timeout = type === 'error' ? 4000 : 2500; // Erros ficam mais tempo
    const timer = setTimeout(() => setFeedbackMessage(null), timeout);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const fetchHabilidades = async () => {
      if (formData.modoTemaLivre) { setHabilidades([]); return; }
      try {
        const data = await buscarHabilidades();
        setHabilidades(data);
      } catch (error) {
        showFeedback('Erro ao carregar habilidades. Tente recarregar a página.', 'error');
      }
    };
    setFormData(prev => ({ ...prev, habilidade: formData.modoTemaLivre ? [] : [] })); // mantém reset
    fetchHabilidades();
  }, [formData.anoEscolar, formData.componente, formData.modoTemaLivre, showFeedback]);

  const handleChange = useCallback((e, group = null, key = null) => {
    if (group && key) {
      // Handle checkbox changes
      setFormData(prev => ({ ...prev, [group]: { ...prev[group], [key]: !prev[group][key] } }));
      if (errors[group]) setErrors(prev => ({ ...prev, [group]: null }));
    } else {
      // Handle regular input changes
      const { name, value } = e.target;
      setFormData(prev => ({ ...prev, [name]: value }));
      if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }));
    }
  }, [errors]);

  const handleHabilidadeChange = useCallback(selectedOptions => {
    const limitados = (selectedOptions || []).slice(0, 2);
    setFormData(prev => ({ ...prev, habilidade: limitados }));
    if (errors.habilidade) setErrors(prev => ({ ...prev, habilidade: null }));
  }, [errors]);

  const handleRemoveHabilidade = useCallback(habilidadeToRemove => {
    setFormData(prev => ({ ...prev, habilidade: prev.habilidade.filter(h => h.value !== habilidadeToRemove.value) }));
  }, []);

  // Smart Autocomplete Handlers
  const handleHabilidadeInput = useCallback((action, value = '') => {
    const updates = {
      change: { habilidadeInput: value, showHabilidadeSuggestions: true, highlightedSuggestion: -1 },
      focus: { showHabilidadeSuggestions: true },
      blur: { showHabilidadeSuggestions: false, highlightedSuggestion: -1 }
    };
    
    if (action === 'blur') {
      setTimeout(() => setFormData(prev => ({ ...prev, ...updates[action] })), 200);
    } else {
      setFormData(prev => ({ ...prev, ...updates[action] }));
    }
  }, []);

  const handleSuggestionSelect = useCallback((habilidade) => {
    if (formData.habilidade.length >= 2) return;
    
    const habilidadeExists = formData.habilidade.some(h => h.value === habilidade.value);
    if (habilidadeExists) return;

    setFormData(prev => ({ 
      ...prev, 
      habilidade: [...prev.habilidade, habilidade],
      habilidadeInput: '',
      showHabilidadeSuggestions: false,
      highlightedSuggestion: -1
    }));
    
    if (errors.habilidade) setErrors(prev => ({ ...prev, habilidade: null }));
  }, [formData.habilidade, errors]);

  const handleToggleSelectMode = useCallback(() => {
    setFormData(prev => ({ 
      ...prev, 
      showFullList: !prev.showFullList,
      showHabilidadeSuggestions: false,
      highlightedSuggestion: -1
    }));
  }, []);

  const handleCloseFullList = useCallback(() => {
    setFormData(prev => ({ 
      ...prev, 
      showFullList: false,
      highlightedSuggestion: -1
    }));
  }, []);

  const handleFieldClick = useCallback(() => {
    setFormData(prev => ({ 
      ...prev, 
      showHabilidadeSuggestions: true,
      highlightedSuggestion: -1
    }));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Previne cliques duplos
    if (showLoader) {
      return;
    }

    try {
      // marca campos como tocados (incluindo temaLivre para o modo tema livre)
      setTocado({
        nomeLista: true,
        anoEscolar: true,
        numQuestoes: true,
        habilidade: true,
        tipos: true,
        componente: true,
        temaLivre: true,
      });

      const newErrors = {};

      // validações comuns
      if (!formData.nomeLista.trim()) newErrors.nomeLista = 'O nome do documento é obrigatório.';
      if (!formData.componente) newErrors.componente = 'O componente curricular é obrigatório.';
      if (!formData.anoEscolar) newErrors.anoEscolar = 'O ano escolar é obrigatório.';

      const numQuestoesValido = Number(formData.numQuestoes);
      if (!numQuestoesValido || numQuestoesValido < 5 || numQuestoesValido > 15) {
        newErrors.numQuestoes = 'O nº de questões deve ser entre 5 e 15.';
      }

      // validações específicas por modo
      if (formData.modoTemaLivre && (!formData.temaLivre || formData.temaLivre.trim().length < 3)) {
        newErrors.temaLivre = 'Descreva o tema (mín. 3 caracteres).';
      } else if (!formData.modoTemaLivre && formData.habilidade.length === 0) {
        newErrors.habilidade = 'Selecione ao menos uma habilidade.';
      }

      // tipos de questão
      if (!Object.values(formData.tipos).some((val) => val)) {
        newErrors.tipos = 'Selecione pelo menos um tipo de questão.';
      }

      // se houver erros, exibe feedback e interrompe
      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        const camposComErro = Object.keys(newErrors).length;
        showFeedback(
          camposComErro === 1 
            ? 'Há 1 campo obrigatório que precisa ser preenchido.'
            : `Há ${camposComErro} campos obrigatórios que precisam ser preenchidos.`,
          'error'
        );
        
        // Scroll para o primeiro campo com erro
        const elementoErro = document.querySelector(`[name="${Object.keys(newErrors)[0]}"]`);
        elementoErro?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        elementoErro?.focus();
        return;
      }

      // monta payload final
      const dados = {
        nomeLista: formData.nomeLista.trim(),
        anoEscolar: formData.anoEscolar,
        numQuestoes: Number(formData.numQuestoes),
        dificuldade: formData.dificuldade,
        tiposSelecionados: Object.entries(formData.tipos).filter(([, v]) => v).map(([k]) => k),
        userEmail: user?.email,
        componente: formData.componente,
        ...(formData.modoTemaLivre 
          ? { tema_livre: formData.temaLivre.trim() } 
          : { habilidade_ids: formData.habilidade.map((a) => a.value) }
        )
      };

      setShowLoader(true);
      setCurrentStep(0);

      // Validação adicional antes de enviar
      if (!user?.email) {
        throw new Error('Usuário não autenticado. Por favor, faça login novamente.');
      }

      const responseData = await enviarDadosLista(dados);
      
      if (!responseData?.uuid) {
        throw new Error('Resposta inválida do servidor. Tente novamente.');
      }
      
      showFeedback('Lista criada com sucesso!', 'success');
      setShowLoader(false);
      navigate(`/editar-lista/${responseData.uuid}`);
    } catch (error) {
      console.error('Erro ao gerar lista:', error);
      setShowLoader(false);
      showFeedback(
        error?.response?.data?.erro || error?.message || 'Erro ao criar a lista. Por favor, tente novamente.',
        'error'
      );
    }
  };

  const habilidadesFiltradas = useMemo(() => {
    if (formData.modoTemaLivre || !formData.anoEscolar || !formData.componente || !habilidades.length) return [];
    
    const [anoNumero, nivelSigla] = formData.anoEscolar.split(' ');
    const searchTerm = (formData.habilidadeInput || '').toLowerCase();
    
    return habilidades
      .filter(h => {
        const hNumeroMatch = h.ano.startsWith(anoNumero);
        const hNivelMatch = (nivelSigla === 'EF' && h.ano.toLowerCase().includes('fundamental')) ||
                           (nivelSigla === 'EM' && h.ano.toLowerCase().includes('médio'));
        const baseMatch = hNumeroMatch && hNivelMatch && h.componente === formData.componente;
        
        if (!baseMatch) return false;
        if (!searchTerm) return true;
        
        return h.codigo_bncc.toLowerCase().includes(searchTerm) || 
               h.objetos_de_conhecimento.toLowerCase().includes(searchTerm);
      })
      .map(h => ({
        value: h.id,
        label: `${h.codigo_bncc} - ${h.objetos_de_conhecimento}`,
        codigo_bncc: h.codigo_bncc,
        habilidade_bncc: h.habilidade_bncc,
        unidades_tematicas: h.unidades_tematicas,
        objetos_de_conhecimento: h.objetos_de_conhecimento
      }));
  }, [formData.anoEscolar, formData.componente, formData.modoTemaLivre, formData.habilidadeInput, habilidades]);


  const camposPreenchidos = useMemo(() => [
    formData.nomeLista.trim(),
    formData.anoEscolar,
    formData.numQuestoes && Number(formData.numQuestoes) >= 5 && Number(formData.numQuestoes) <= 15,
    formData.modoTemaLivre ? (formData.temaLivre && formData.temaLivre.trim().length >= 3) : (formData.habilidade.length > 0),
    Object.values(formData.tipos).some((val) => val)
  ], [formData.nomeLista, formData.anoEscolar, formData.numQuestoes, formData.modoTemaLivre, formData.temaLivre, formData.habilidade.length, formData.tipos]);
  
  const progresso = useMemo(() => (camposPreenchidos.filter(Boolean).length / 5) * 100, [camposPreenchidos]);

  return (
      <div className="gerar-atividades">

        <TutorialModal open={tutorialOpen} onClose={() => setTutorialOpen(false)} videoUrl={tutorialUrl} youtubeUrl={youtubeUrl} />
        {feedbackMessage && (<FeedbackToast message={feedbackMessage} />)}

        {showLoader && (
            <LoadingScreen
                isVisible={showLoader}
                title="Gerando lista de exercícios"
                subtitle="Aguarde enquanto criamos sua lista personalizada..."
                primaryColor="#6366F1"
                icon={Sparkles}
                estimatedDuration={12000}
                adaptiveMode={true}
                steps={[
                  { id: 0, title: 'Analisando parâmetros', description: 'Processando informações da lista...', icon: BookOpen },
                  { id: 1, title: 'Selecionando questões', description: 'Escolhendo exercícios adequados...', icon: Target },
                  { id: 2, title: 'Organizando conteúdo', description: 'Estruturando a sequência didática...', icon: Lightbulb },
                  { id: 3, title: 'Organizando questões', description: 'Estruturando a sequência das questões...', icon: Users }
                ]}
            />
        )}

        <div className="gerar-atividades__card">
          {/* Cabeçalho */}
          <div className="ga-card-header">
            <div className="ga-header-left">
            <span className="ga-header-badge">
              <Sparkles size={28} color="#fff" />
            </span>
              <div>
                <h2 className="ga-title">Lista de Exercícios</h2>
                <p className="ga-subtitle">Crie listas de exercícios personalizadas.</p>
              </div>
            </div>
            <div className="ga-header-actions">
              <TutorialButton id="tutorial-btn" onClick={() => setTutorialOpen(true)} label="Tutorial" />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="gerar-atividades__form ga-form">
            {/* TOPO: Nome do Documento (esquerda) + Tipo de Questão (direita) */}
            <div className="ga-top-split">
              {/* Nome do Documento */}
              <div className="form-group">
                <label className="form-label">
                  Nome do Documento <span className="req">*</span>
                </label>
                <input
                    id="nome-lista"
                    name="nomeLista"
                    type="text"
                    value={formData.nomeLista}
                    onChange={e => {
                      const { name, value } = e.target;
                      setFormData(prev => ({ ...prev, [name]: value }));
                      if (errors.nomeLista) setErrors(prev => ({ ...prev, nomeLista: null }));
                    }}
                    onBlur={() => setTocado(prev => ({ ...prev, nomeLista: true }))}
                    placeholder="Digite o nome do documento"
                    className={`form-input altura-fixa ${errors.nomeLista && tocado.nomeLista ? 'form-input--error' : ''}`}
                    aria-invalid={errors.nomeLista && tocado.nomeLista ? 'true' : 'false'}
                    aria-describedby={errors.nomeLista && tocado.nomeLista ? 'nomeLista-error' : null}
                />
                <div className="field-help">
                  {errors.nomeLista && tocado.nomeLista && (
                      <p id="nomeLista-error" className="error-message" role="alert">{errors.nomeLista}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Grid superior */}
            <div className="form-grid">
              {/* Componente */}
              <div className="form-group">
                <label className="form-label" htmlFor="componente-curricular">
                  Componente curricular <span className="req">*</span>
                </label>
                <Select
                    id="componente-curricular"
                    inputId="componente-curricular" // vincula o label ao input interno do react-select
                    className={`react-select altura-fixa ${errors.componente && tocado.componente ? 'form-select--error' : ''}`}
                    classNamePrefix="react-select"
                    options={componentes}
                    value={componentes.find(opt => opt.value === formData.componente) || null}
                    onChange={async opt => {
                      const val = opt ? opt.value : '';
                      setFormData(prev => ({ ...prev, componente: val, anoEscolar: '' }));
                      try {
                        const anos = await listarAnosEscolares(val || undefined);
                        setAnosEscolares(anos);
                      } catch (err) { console.error('Erro ao filtrar anos', err); }
                      if (errors.componente) setErrors(prev => ({ ...prev, componente: null }));
                    }}
                    placeholder="Digite ou selecione..."
                    isClearable
                    menuPortalTarget={typeof window !== 'undefined' ? document.body : null}
                />
                <div className="field-help">
                  {errors.componente && tocado.componente && (
                      <p className="error-message" role="alert">{errors.componente}</p>
                  )}
                </div>
              </div>

              {/* Ano / Turma */}
              <div className="form-group">
                <label htmlFor="ano-turma" className="form-label">
                  Ano / Turma <span className="req">*</span>
                </label>
                <Select
                    id="ano-turma"
                    inputId="ano-turma"
                    className={`react-select altura-fixa ${errors.anoEscolar && tocado.anoEscolar ? 'form-select--error' : ''}`}
                    classNamePrefix="react-select"
                    options={anosEscolares}
                    value={anosEscolares.find(opt => opt.value === formData.anoEscolar) || null}
                    onChange={opt => {
                      setFormData(prev => ({ ...prev, anoEscolar: opt ? opt.value : '' }));
                      setTocado(prev => ({ ...prev, anoEscolar: true }));
                      if (errors.anoEscolar) setErrors(prev => ({ ...prev, anoEscolar: null }));
                    }}
                    onBlur={() => setTocado(prev => ({ ...prev, anoEscolar: true }))}
                    placeholder="Selecione o ano..."
                    isClearable
                    menuPortalTarget={typeof window !== 'undefined' ? document.body : null}
                />
                <div className="field-help">
                  {errors.anoEscolar && tocado.anoEscolar && (
                      <p id="anoEscolar-error" className="error-message" role="alert">{errors.anoEscolar}</p>
                  )}
                </div>
              </div>

              {/* Nº de questões */}
              <div className="form-group form-group--relative">
                <label htmlFor="num-questoes" className="form-label">
                  Nº de questões <span className="req">*</span>
                  <span className="tooltip-wrapper" tabIndex={0}>
        <Info size={17} color="#627FF4" aria-label="Informação" />
        <span className="tooltip-num-questoes">de 5 a 15 questões</span>
      </span>
                </label>
                <input
                    id="num-questoes"
                    name="numQuestoes"
                    type="number"
                    value={formData.numQuestoes}
                    placeholder="Entre 5 e 15 questões"
                    onChange={e => {
                      const raw = e.target.value;
                      if (/^\d*$/.test(raw)) {
                        setFormData(prev => ({ ...prev, numQuestoes: raw }));
                        if (errors.numQuestoes) setErrors(prev => ({ ...prev, numQuestoes: null }));
                      }
                    }}
                    onBlur={() => {
                      setTocado(prev => ({ ...prev, numQuestoes: true }));
                      const num = Number(formData.numQuestoes);
                      if (!formData.numQuestoes || num < 5 || num > 15) {
                        setErrors(prev => ({ ...prev, numQuestoes: 'O nº de questões deve ser entre 5 e 15.' }));
                      }
                    }}
                    className={`form-input altura-fixa ${errors.numQuestoes && tocado.numQuestoes ? 'form-input--error' : ''}`}
                    aria-invalid={errors.numQuestoes && tocado.numQuestoes ? 'true' : 'false'}
                    aria-describedby={errors.numQuestoes && tocado.numQuestoes ? 'numQuestoes-error' : null}
                />
                <div className="field-help">
                  {errors.numQuestoes && tocado.numQuestoes && (
                      <p id="numQuestoes-error" className="error-message" role="alert">{errors.numQuestoes}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Modo de Geração */}
            <div className="form-group">
                <label className="form-label" id="modo-geracao-label">
                  Modo de Geração
                  <span className="req">*</span>
                </label>

              <div className="modo-geracao-cards" role="radiogroup" aria-labelledby="modo-geracao-label">
                <ModoCard
                  isSelected={formData.modoTemaLivre}
                  onClick={() => {
                    setFormData(prev => ({ ...prev, modoTemaLivre: true, habilidade: [] }));
                    setErrors(prev => ({ ...prev, habilidade: null, temaLivre: null }));
                    setTocado(prev => ({ ...prev, temaLivre: true, habilidade: false }));
                  }}
                  icon={
                    <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14,2 14,8 20,8"/>
                      <line x1="16" y1="13" x2="8" y2="13"/>
                      <line x1="16" y1="17" x2="8" y2="17"/>
                      <polyline points="10,9 9,9 8,9"/>
                    </svg>
                  }
                  title="Tema livre"
                  description="Você descreve o assunto e geramos alinhado ao componente/ano."
                  className="modo-card--tema"
                />
                <ModoCard
                  isSelected={!formData.modoTemaLivre}
                  onClick={() => {
                    setFormData(prev => ({ ...prev, modoTemaLivre: false, temaLivre: '' }));
                    setErrors(prev => ({ ...prev, habilidade: null, temaLivre: null }));
                    setTocado(prev => ({ ...prev, habilidade: true }));
                  }}
                  icon={
                    <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                      <polyline points="3.27,6.96 12,12.01 20.73,6.96"/>
                      <line x1="12" y1="22.08" x2="12" y2="12"/>
                    </svg>
                  }
                  title="BNCC (habilidades)"
                  description="Selecione habilidades/objetos e gere questões diretamente."
                  className="modo-card--bncc"
                />
              </div>
            </div>

            {/* Campo condicional */}
            {formData.modoTemaLivre ? (
              <div className="form-group tema-livre-section">
                <label className="form-label" htmlFor="tema-livre">
                  Tema livre <span className="req">*</span>
                </label>
                <p className="helper-text" style={{ marginTop: '0.25rem', marginBottom: '0.5rem', color: '#6b7280', fontSize: '0.9rem' }}>
                  Descreva o assunto central da atividade.
                </p>
                <input
                  id="tema-livre"
                  name="temaLivre"
                  type="text"
                  value={formData.temaLivre}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, temaLivre: e.target.value }));
                    if (errors.temaLivre) setErrors(prev => ({ ...prev, temaLivre: null }));
                  }}
                  onBlur={() => setTocado(prev => ({ ...prev, temaLivre: true }))}
                  placeholder="Ex.: Frações no cotidiano, leitura e interpretação de gráficos..."
                  className={`form-input altura-fixa ${errors.temaLivre && tocado.temaLivre ? 'form-input--error' : ''}`}
                  aria-invalid={errors.temaLivre && tocado.temaLivre ? 'true' : 'false'}
                  aria-describedby={errors.temaLivre && tocado.temaLivre ? 'temaLivre-error' : null}
                />
                <div className="field-help">
                  {errors.temaLivre && tocado.temaLivre && (
                    <p id="temaLivre-error" className="error-message" role="alert">{errors.temaLivre}</p>
                  )}
                </div>
              </div>
            ) : (
                <>
                  <div className="form-group habilidade-spacing">
                    <label className="form-label" htmlFor="habilidade-smart">
                      Habilidade / Objeto de Conhecimento
                      <span className="tooltip-wrapper" tabIndex={0}>
          <Info size={17} color="#627FF4" aria-label="Informação" />
                        <span className="tooltip-num-questoes">Digite para buscar ou selecione até 2 habilidades.</span>
        </span>
                    </label>
                    <div className={`habilidade-field-container ${formData.showHabilidadeSuggestions ? 'dropdown-open' : ''}`}>
                      {/* Chips selecionados */}
                      {formData.habilidade.length > 0 && (
                        <div className="habilidade-chips-wrapper">
                          {formData.habilidade.map((habilidade, index) => (
                            <div key={habilidade.value || habilidade.id || index} className="habilidade-chip">
                              <span className="chip-code">{habilidade.codigo_bncc || habilidade.value}</span>
                              <span className="chip-text">{habilidade.objetos_de_conhecimento}</span>
                              <button
                                type="button"
                                className="chip-remove"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveHabilidade(habilidade);
                                }}
                                title="Remover habilidade"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Campo de busca */}
                      <div className="habilidade-input-wrapper">
                        <input
                          type="text"
                          id="habilidade-smart"
                          className="habilidade-search-input"
                          placeholder={formData.habilidade.length === 0 
                            ? 'Digite para buscar ou clique para selecionar...' 
                            : 'Digite para adicionar mais...'
                          }
                          value={formData.habilidadeInput || ''}
                          onChange={(e) => handleHabilidadeInput('change', e.target.value)}
                          onFocus={() => handleHabilidadeInput('focus')}
                          onBlur={() => handleHabilidadeInput('blur')}
                          autoComplete="off"
                        />
                        <div 
                          className="field-arrow"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFormData(prev => ({ 
                              ...prev, 
                              showHabilidadeSuggestions: !prev.showHabilidadeSuggestions
                            }));
                          }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M8 10l4 4 4-4" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      </div>

                      {/* Dropdown de opções */}
                      {formData.showHabilidadeSuggestions && (
                        <div className="habilidade-dropdown">
                          <div className="dropdown-header">
                            <span>Selecione até 2 habilidades</span>
                            <span className="selection-count">{formData.habilidade.length}/2</span>
                          </div>
                          <div className="dropdown-content">
                            {!formData.anoEscolar || !formData.componente ? (
                              <div className="no-options-message">
                                <div className="no-options-icon">
                                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M21 21L16.514 16.506L21 21ZM19 10.5C19 15.194 15.194 19 10.5 19C5.806 19 2 15.194 2 10.5C2 5.806 5.806 2 10.5 2C15.194 2 19 5.806 19 10.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                </div>
                                <div className="no-options-text">
                                  Selecione primeiro o Componente curricular e Ano/Turma para ver as habilidades disponíveis.
                                </div>
                              </div>
                            ) : habilidadesFiltradas.length > 0 ? (
                              habilidadesFiltradas.slice(0, 10).map((habilidade, index) => {
                                const isSelected = formData.habilidade.some(h => h.value === habilidade.value);
                                const canSelect = formData.habilidade.length < 2 || isSelected;
                                
                                return (
                                  <div
                                    key={habilidade.value || habilidade.id || index}
                                    className={`dropdown-item ${isSelected ? 'selected' : ''} ${!canSelect ? 'disabled' : ''}`}
                                    onClick={() => canSelect && handleSuggestionSelect(habilidade)}
                                  >
                                    <div className="item-content">
                                      <div className="item-text">
                                        <span className="item-code">{habilidade.codigo_bncc || habilidade.value}</span>
                                        <span className="item-description">{habilidade.objetos_de_conhecimento}</span>
                                      </div>
                                    </div>
                                    {isSelected && (
                                      <div className="item-check">✓</div>
                                    )}
                                    {!isSelected && canSelect && (
                                      <div className="item-action">+</div>
                                    )}
                                  </div>
                                );
                              })
                            ) : (
                              <div className="no-options-message">
                                <div className="no-options-icon">
                                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M21 21L16.514 16.506L21 21ZM19 10.5C19 15.194 15.194 19 10.5 19C5.806 19 2 15.194 2 10.5C2 5.806 5.806 2 10.5 2C15.194 2 19 5.806 19 10.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                </div>
                                <div className="no-options-text">
                                  {formData.anoEscolar && formData.componente 
                                    ? 'Nenhuma habilidade encontrada. Em breve haverá dados da BNCC disponíveis para esta etapa.'
                                    : 'Selecione primeiro o Componente curricular e Ano/Turma para ver as habilidades disponíveis.'
                                  }
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="field-help">
                      {errors.habilidade && tocado.habilidade && (
                          <p className="error-message" role="alert">{errors.habilidade}</p>
                      )}
                    </div>
                  </div>

                  {formData.habilidade.length > 0 && (
                      <div className="habilidade-info">
                        {formData.habilidade.map((h, idx) => (
                            <HabilidadeCard key={h.value || h.id || idx} h={h} onRemove={handleRemoveHabilidade} />
                        ))}
                      </div>
                  )}
                </>
            )}

            {/* Nível de Dificuldade */}
            <div className="form-group">
                <label className="form-label dificuldade-label" htmlFor="difficulty-slider">
        Nível de Dificuldade <span className="req req--red">*</span>
                </label>

              {/* Slider de dificuldade */}
              <div className={`difficulty-slider-container nivel-${formData.dificuldade}`}>
                <div className="difficulty-slider-wrapper">
                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="1"
                    value={formData.dificuldade}
                    onChange={(e) => setFormData(prev => ({ ...prev, dificuldade: parseInt(e.target.value) }))}
                    className="form-range difficulty-slider"
                    id="difficulty-slider"
                    aria-label="Nível de dificuldade"
                    aria-valuemin="1"
                    aria-valuemax="3"
                    aria-valuenow={formData.dificuldade}
                    aria-valuetext={`Nível ${formData.dificuldade === 1 ? 'Fácil' : formData.dificuldade === 2 ? 'Médio' : 'Difícil'}`}
                  />
                </div>
                <div className="difficulty-labels">
                  <span className="easy">Fácil</span>
                  <span className="medium">Médio</span>
                  <span className="hard">Difícil</span>
                </div>
                </div>

              {/* Descrição dinâmica */}
              <div className="dificuldade-descricao">
                  <p>
                    {formData.dificuldade === 1 && 'Questões introdutórias e diretas, ideais para reforçar conceitos básicos'}
                    {formData.dificuldade === 2 && 'Questões com raciocínio moderado, desenvolvendo habilidades de análise'}
                    {formData.dificuldade === 3 && 'Questões complexas e desafiadoras, estimulando pensamento crítico avançado'}
                  </p>
                </div>
            </div>

            {/* Tipos de Questão */}
            <div className="form-group">
              <label className="form-label" id="tipo-questao-label">
                Tipo de Questão <span className="req">*</span>
              </label>
                  <div className="modo-geracao-cards" role="radiogroup" aria-labelledby="tipo-questao-label">
                    <ModoCard
                      isSelected={formData.tipos.objetiva}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleChange(null, 'tipos', 'objetiva');
                        setTocado(prev => ({ ...prev, tipos: true }));
                        if (errors.tipos) setErrors(prev => ({ ...prev, tipos: null }));
                      }}
                      icon={
                        <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
                          <circle cx="12" cy="12" r="10"/>
                          <path d="M9 12l2 2 4-4"/>
                        </svg>
                      }
                      title="Objetiva"
                      description="Questões de múltipla escolha com alternativas"
                      className="modo-card--objetiva"
                    />
                    <ModoCard
                      isSelected={formData.tipos.discursiva}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleChange(null, 'tipos', 'discursiva');
                        setTocado(prev => ({ ...prev, tipos: true }));
                        if (errors.tipos) setErrors(prev => ({ ...prev, tipos: null }));
                      }}
                      icon={
                        <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
                          <path d="M12 20h9"/>
                          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                        </svg>
                      }
                      title="Discursiva"
                      description="Questões abertas que exigem resposta escrita pelo aluno"
                      className="modo-card--discursiva"
                    />
                  </div>
                  {errors.tipos && tocado.tipos && <p className="error-message" role="alert">{errors.tipos}</p>}
            </div>

            {/* Botão de criar lista */}
            <div className="ga-actions-centered">
              <button 
                id="gerar-lista-btn" 
                type="submit" 
                className="btn-primary btn-generate"
                disabled={showLoader}
              >
                {showLoader ? (
                  <>
                    <div className="spinner" style={{ width: '18px', height: '18px', border: '2px solid #fff', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Sparkles size={18} color={'#fff'} />
                    Gerar lista
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
  );
}
