import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Network, Eye, Download, X as LucideX, Search, FileText, AlertCircle, CheckCircle, ChevronDown, ChevronUp, Flag, PartyPopper } from 'lucide-react';
import axios from '../services/axiosInstance';
import Select from 'react-select';
import TutorialButton from '../components/TutorialButton';
import TutorialModal from '../components/TutorialModal';
import { useAuth } from '../hooks/useAuth.jsx';
import '../style/mapa-mental.css'; // NOVO: estilos consolidados da página (escopo .page--mapa-mental)


const PAGE_SIZES = [5, 10, 15, 20, 25, 50];
const API_BASE = (import.meta.env.VITE_API_BASE_URL || axios.defaults.baseURL || '').replace(/\/?$/, '/');

// Cores da identidade visual da aplicação para os cards de mapa mental - paleta harmoniosa e sofisticada
const CARD_COLORS = [
  { bg: '#FFFFFF', accent: 'linear-gradient(135deg, #F69543 0%, #F29E6D 100%)', icon: '#F69543', tag: '#F69543' },
  { bg: '#FFFFFF', accent: 'linear-gradient(135deg, #021D40 0%, #1A4A7F 100%)', icon: '#021D40', tag: '#021D40' },
  { bg: '#FFFFFF', accent: 'linear-gradient(135deg, #FFB848 0%, #F69543 100%)', icon: '#FFB848', tag: '#FFB848' },
  { bg: '#FFFFFF', accent: 'linear-gradient(135deg, #1A4A7F 0%, #324a6d 100%)', icon: '#1A4A7F', tag: '#1A4A7F' },
  { bg: '#FFFFFF', accent: 'linear-gradient(135deg, #F29E6D 0%, #FFB848 100%)', icon: '#F29E6D', tag: '#F29E6D' },
  { bg: '#FFFFFF', accent: 'linear-gradient(135deg, #324a6d 0%, #021D40 100%)', icon: '#324a6d', tag: '#324a6d' }
];

const pathToUrl = (p) => {
  if (!p || typeof p !== 'string') return '';
  return p.split('/').map(encodeURIComponent).join('/');
};

export default function MapaMental() {
  const { user } = useAuth();
  if (user && !user.funcionalidades?.includes('baixar-mapa-mental')) {
    return <div className="p-4 text-center text-gray-500">Funcionalidade não disponível para seu perfil.</div>;
  }
  // Estados para seleção
  const [componentes, setComponentes] = useState([]);
  const [componenteSelecionado, setComponenteSelecionado] = useState('');
  const [subcomponentes, setSubcomponentes] = useState([]);
  const [subcomponenteSelecionado, setSubcomponenteSelecionado] = useState("");
  const [mapasMentais, setMapasMentais] = useState([]); // Lista de mapas mentais
  const [busca, setBusca] = useState("");
  const [sugestoes, setSugestoes] = useState([]); // Sugestões para autocomplete
  const [showSugestoes, setShowSugestoes] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10); // Valor padrão mudado para 10
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [shouldShowMaps, setShouldShowMaps] = useState(false); // Controla se deve mostrar mapas
  const viewMode = 'grid'; // Visualização fixada em grid
  const [columns, setColumns] = useState(4); // Número de colunas para grid
  const buscaRef = useRef();
  const [hoveredIcon, setHoveredIcon] = useState(null);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const tutorialUrl = "https://www.youtube.com/embed/yp_D89E_tbQ?si=nScevufRJiUZONvG";
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewSrc, setPreviewSrc] = useState('');
  
  // Estados para toast notifications
  const [toasts, setToasts] = useState([]);
  const [isMobile, setIsMobile] = useState(false);

  // Função para carregar mapas de uma página específica
  const loadPage = async (targetPage) => {
    if (loading) return;
    
    setLoading(true);
    
    try {
      const params = { page: targetPage, page_size: pageSize };
      if (componenteSelecionado) params.componente = componenteSelecionado;
      if (subcomponenteSelecionado) params.subcomponente = subcomponenteSelecionado;
      if (busca) params.q = busca;
      
      const response = await axios.get('mapas_mentais/mapas/', { params });
      const dados = response.data.results || response.data;
      
      setMapasMentais(dados);
      setTotal(response.data.count !== undefined ? response.data.count : dados.length);
      setPage(targetPage);
        setHasMore(dados.length === pageSize);
      
    } catch (err) {
      console.error('Erro ao carregar página:', err);
      setMapasMentais([]);
      setTotal(0);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  // Calcular número de colunas baseado no tamanho da tela
  useEffect(() => {
    const updateColumns = () => {
      const width = window.innerWidth;
      if (width < 640) setColumns(1); // Mobile
      else if (width < 768) setColumns(2); // Tablet pequeno
      else if (width < 1024) setColumns(3); // Tablet
      else if (width < 1280) setColumns(4); // Desktop pequeno
      else setColumns(5); // Desktop grande
    };
    
    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, []);

  // Monitorar mudanças no estado previewOpen
  useEffect(() => {
    console.log('Estado previewOpen mudou para:', previewOpen);
    console.log('Estado previewSrc mudou para:', previewSrc);
  }, [previewOpen, previewSrc]);

  // Detectar se é dispositivo móvel
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Função para adicionar toast
  const addToast = (message, type = 'success') => {
    const id = Date.now();
    const newToast = { id, message, type };
    
    // Limitar a 3 toasts simultâneos para evitar poluição visual
    setToasts(prev => {
      const newToasts = [...prev, newToast];
      if (newToasts.length > 3) {
        return newToasts.slice(-3); // Manter apenas os 3 mais recentes
      }
      return newToasts;
    });
    
    // Auto-remover após 2.5 segundos (reduzido para evitar poluição)
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 2500);
  };

  // Função para remover toast
  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  // Função para abrir preview (sem toast desnecessário)
  const openPreview = (previewPath) => {
    console.log('openPreview chamada com:', previewPath);
    console.log('API_BASE:', API_BASE);
    
    // Verificar se previewPath é válido
    if (!previewPath || previewPath === 'mapas_mentais/download//') {
      console.error('previewPath inválido:', previewPath);
      addToast('Erro: caminho do arquivo não encontrado', 'error');
      return;
    }
    
    const fullUrl = `${API_BASE}${previewPath}?download=0`;
    console.log('URL completa:', fullUrl);
    
    setPreviewSrc(fullUrl);
    setPreviewOpen(true);
    // Notificação sutil apenas para confirmar a ação
    addToast('Preview aberto', 'success');
  };

  // Função para fechar preview
  const closePreview = () => {
    setPreviewOpen(false);
    setPreviewSrc('');
  };

  // Função para executar busca (simplificada)
  const executarBusca = () => {
    // Resetar estado para nova busca
    setPage(1);
    setMapasMentais([]);
    setHasMore(true);
    
    // A busca será executada automaticamente pelo useEffect
  };

  // Função para mudar página
  const handlePageChange = (newPage) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Calcular total de páginas
  const totalPages = Math.ceil(total / pageSize);

  const campoPadrao = {
    height: 44,
    padding: '0 14px',
    fontSize: 15,
    borderRadius: 8,
    border: '1px solid #ddd',
    background: '#fafbfc',
    fontFamily: 'Quicksand, sans-serif',
    boxSizing: 'border-box',
    width: '100%'
  };

  // Buscar componentes curriculares dinamicamente do backend
  useEffect(() => {
    async function fetchComponentes() {
      try {
        const response = await axios.get('mapas_mentais/componentes/');
        if (response.data && Array.isArray(response.data.componentes)) {
          setComponentes(response.data.componentes);
        }
      } catch (err) {
        setComponentes([]);
      }
    }
    fetchComponentes();
  }, []);

  // Buscar subcomponentes quando um componente é selecionado
  useEffect(() => {
    async function fetchSubcomponentes() {
      if (!componenteSelecionado) {
        setSubcomponentes([]);
        return;
      }
      try {
        const response = await axios.get('mapas_mentais/subcomponentes/', { params: { componente: componenteSelecionado } });
        if (response.data && Array.isArray(response.data.subcomponentes)) {
          setSubcomponentes(response.data.subcomponentes);
        } else {
          setSubcomponentes([]);
        }
      } catch (err) {
        setSubcomponentes([]);
      }
    }
    fetchSubcomponentes();
    setSubcomponenteSelecionado('');
  }, [componenteSelecionado]);

  // Função para calcular relevância da busca
  const calcularRelevancia = (busca, texto) => {
    if (busca === '') return 0;
    
    // Busca exata tem maior relevância
    if (texto.includes(busca)) {
      if (texto.startsWith(busca)) return 100; // Começa com a busca
      return 80; // Contém a busca
    }
    
    // Busca por palavras individuais
    const palavrasBusca = busca.split(' ').filter(p => p.length > 0);
    const palavrasTexto = texto.split(' ').filter(p => p.length > 0);
    
    let relevancia = 0;
    palavrasBusca.forEach(palavra => {
      if (palavrasTexto.some(p => p.startsWith(palavra))) {
        relevancia += 60; // Palavra começa com busca
      } else if (palavrasTexto.some(p => p.includes(palavra))) {
        relevancia += 40; // Palavra contém busca
      }
    });
    
    return relevancia;
  };

  // Função para buscar mapas mentais filtrados (com notificações)
  const fetchMapas = async (reset = true) => {
    try {
      setLoading(true);
      
      const targetPage = reset ? 1 : page;
      
      const params = { page: targetPage, page_size: pageSize };
      if (componenteSelecionado) params.componente = componenteSelecionado;
      if (subcomponenteSelecionado) params.subcomponente = subcomponenteSelecionado;
      if (busca) params.q = busca;
      
      console.log('Fazendo requisição para API com params:', params);
      const response = await axios.get('mapas_mentais/mapas/', { params });
      console.log('Resposta da API:', response.data);
      
      const dados = response.data.results || response.data;
      
      setMapasMentais(dados);
      setTotal(response.data.count !== undefined ? response.data.count : dados.length);
      if (reset) setPage(1);
      setHasMore(dados.length === pageSize);
      
      // Adicionar toast informativo sobre os resultados
      const totalReal = response.data.count !== undefined ? response.data.count : dados.length;
      
      // Só mostrar notificações quando há filtros ativos ou quando não há resultados
      if (dados.length === 0 || totalReal === 0) {
        // Mostrar notificação para casos sem resultados
        if (busca) {
          addToast(`Nenhum resultado encontrado para "${busca}"`, 'info');
        } else if (componenteSelecionado || subcomponenteSelecionado) {
          addToast('Nenhum mapa mental encontrado para os filtros selecionados', 'info');
        } else {
          addToast('Nenhum mapa mental disponível no momento', 'info');
        }
      } else if (totalReal > 0 && (busca || componenteSelecionado || subcomponenteSelecionado)) {
        // Mostrar notificação de sucesso apenas quando há filtros ativos
        addToast(`${totalReal} mapa(s) mental(is) encontrado(s)`, 'success');
      }
      
      setSugestoes(Array.from(new Set(dados.map(m => {
        return m.nome_arquivo
          .replace(/^Mapa Mental - /i, "")
          .replace(/\.pdf$/i, "")
          .replace(/^\d+\s*-\s*/, "")
          .trim();
      }))));
    } catch (err) {
      console.error('Erro ao buscar mapas mentais:', err);
      setMapasMentais([]);
      setSugestoes([]);
      setTotal(0);
      setHasMore(false);
      
      // Adicionar toast de erro
      if (err.response) {
        addToast(`Erro ${err.response.status}: ${err.response.data?.message || 'Erro ao buscar mapas mentais'}`, 'error');
      } else if (err.request) {
        addToast('Erro de conexão: Verifique sua internet', 'error');
      } else {
        addToast('Erro inesperado ao buscar mapas mentais', 'error');
      }
    } finally {
      setLoading(false);
    }
  };



  // Buscar mapas mentais filtrados (unificado para evitar chamadas duplicadas)
  useEffect(() => {
    // Usar um timer para debounce e evitar múltiplas chamadas
    const timer = setTimeout(() => {
      // Só executar se houver filtros ativos ou busca
      if (componenteSelecionado || subcomponenteSelecionado || busca.trim()) {
        setShouldShowMaps(true);
        fetchMapas(true);
      } else {
        // Sem filtros - não mostrar mapas
        setShouldShowMaps(false);
        setMapasMentais([]);
        setTotal(0);
        setSugestoes([]);
      }
    }, 300); // Debounce reduzido para 300ms

    return () => clearTimeout(timer);
  }, [componenteSelecionado, subcomponenteSelecionado, busca]);

  // Reagir a mudanças no tamanho da página
  useEffect(() => {
    if (shouldShowMaps) {
      setPage(1);
      fetchMapas(true);
    }
  }, [pageSize]);

  // Fechar sugestões ao clicar fora
  useEffect(() => {
    function handleClickOutside(e) {
      if (buscaRef.current && !buscaRef.current.contains(e.target)) {
        setShowSugestoes(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Paginação - removido pois agora usa infinite scroll
  // useEffect(() => { setPage(1); }, [componenteSelecionado, subcomponenteSelecionado, busca, pageSize]);

  const [formData, setFormData] = useState({
    assunto: '',
    anoEscolaridade: '',
    buscarNaWeb: false,
    anexo: null,
  });
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };
  const handleFileChange = (e) => {
    setFormData((prev) => ({ ...prev, anexo: e.target.files[0] }));
  };
  const handleSwitchChange = (e) => {
    setFormData((prev) => ({ ...prev, buscarNaWeb: e.target.checked }));
  };
  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!formData.assunto.trim()) newErrors.assunto = 'O nome do documento é obrigatório.';
    if (Object.keys(newErrors).length > 0) return;
    alert('Mapa mental gerado! (mock)');
  };

  useEffect(() => {
    function handleEsc(e) {
      if (e.key === 'Escape') closePreview();
    }
    if (previewOpen) document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [previewOpen]);

  // Controlar a classe modal-open no body para o rodapé ficar em segundo plano
  useEffect(() => {
    if (previewOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    
    // Cleanup ao desmontar o componente
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [previewOpen]);

    return (
        <div className="page--mapa-mental">
            <div className="mm-card">

                {/* Header */}
                <div className="mm__header">
                    <div className="mm__hero">
            <span className="mm__hero-icon">
              <Network size={32} color="#fff" />
            </span>
                        <div>
                            <h2 className="mm__title">Mapa Mental</h2>
                            <p className="mm__subtitle">Transforme qualquer tema em um mapa mental visual e atrativo.</p>
                        </div>
                    </div>

                    <div className="mm__actions">
                        <TutorialButton
                            onClick={() => setTutorialOpen(true)}
                            label="Tutorial"
                            color="green"
                            className="mm__tutorial-btn"
                        />
                    </div>
                </div>

                <TutorialModal
                    open={tutorialOpen}
                    onClose={() => setTutorialOpen(false)}
                    videoUrl={tutorialUrl}
                    videoTitle="Como gerar um mapa mental?"
                    description="Veja como transformar um tema em um mapa mental visual e atrativo para seus alunos."
                />

                {/* Filtros */}
                <div className="mm__filters">
                    {/* Componente Curricular */}
                    <div className="mm__filter">
                        <label className="mm__label">Componente Curricular</label>
                        <Select
                            className="mm-select"
                            classNamePrefix="mm-select"
                            options={componentes.map(d => ({ value: d, label: d }))}
                            value={componenteSelecionado ? { value: componenteSelecionado, label: componenteSelecionado } : null}
                            onChange={opt => setComponenteSelecionado(opt ? opt.value : '')}
                            placeholder="Selecione ou digite..."
                            isClearable
                            menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                        />
                    </div>

                    {/* Área/tema */}
                    <div className="mm__filter">
                        <label className="mm__label">Área/tema</label>
                        <Select
                            className="mm-select"
                            classNamePrefix="mm-select"
                            options={subcomponentes.map(sub => ({ value: sub, label: sub }))}
                            value={subcomponenteSelecionado ? { value: subcomponenteSelecionado, label: subcomponenteSelecionado } : null}
                            onChange={opt => setSubcomponenteSelecionado(opt ? opt.value : '')}
                            placeholder="Selecione..."
                            isClearable
                            isDisabled={!componenteSelecionado}
                            menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                        />
                    </div>

                    {/* Busca */}
                    <div className="mm__filter" ref={buscaRef}>
                        <label className="mm__label">Buscar por nome ou tema</label>

                        <div className="mm__search">
                            <input
                                type="text"
                                value={busca}
                                onChange={e => {
                                    const valor = e.target.value;
                                    setBusca(valor);
                                    setShowSugestoes(valor.length > 0);

                                    if (valor.length > 0) {
                                        const sugestoesFiltradas = mapasMentais
                                            .map(mapa => {
                                                const nome = mapa.nome_arquivo
                                                    .replace(/^Mapa Mental - /i, '')
                                                    .replace(/\.pdf$/i, '')
                                                    .replace(/^\d+\s*-\s*/, '')
                                                    .trim();
                                                const relevancia = calcularRelevancia(valor.toLowerCase(), nome.toLowerCase());
                                                return { nome, relevancia, original: mapa };
                                            })
                                            .filter(item => item.relevancia > 0)
                                            .sort((a, b) => b.relevancia - a.relevancia)
                                            .slice(0, 8)
                                            .map(item => item.nome);

                                        setSugestoes(sugestoesFiltradas);
                                    } else {
                                        setSugestoes([]);
                                        setShowSugestoes(false);
                                    }
                                }}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        setShowSugestoes(false);
                                    } else if (e.key === 'Escape') {
                                        setShowSugestoes(false);
                                        setBusca('');
                                    }
                                }}
                                onFocus={() => {
                                    if (busca.length > 0) setShowSugestoes(true);
                                }}
                                onBlur={() => {
                                    setTimeout(() => setShowSugestoes(false), 200);
                                }}
                                placeholder="Digite para filtrar por nome ou tema..."
                                className="mm__input"
                            />

                            {/* Indicador de busca ativa */}
                            {busca && (
                                <div className="mm__badge">
                                    <Search size={10} />
                                    {mapasMentais.filter(mapa => {
                                        const nome = mapa.nome_arquivo
                                            .replace(/^Mapa Mental - /i, '')
                                            .replace(/\.pdf$/i, '')
                                            .replace(/^\d+\s*-\s*/, '')
                                            .trim();
                                        return nome.toLowerCase().includes(busca.toLowerCase());
                                    }).length}
                                </div>
                            )}

                            {/* Botão limpar busca */}
                            {busca && (
                                <button
                                    type="button"
                                    className="mm__clear"
                                    onClick={() => {
                                        setBusca('');
                                        setSugestoes([]);
                                        setShowSugestoes(false);
                                    }}
                                    title="Limpar busca"
                                    tabIndex={-1}
                                >
                                    <LucideX size={16} />
                                </button>
                            )}

                            {/* Sugestões */}
                            {showSugestoes && sugestoes.length > 0 && (
                                <div className="mm__suggestions">
                                    {sugestoes.map((sugestao, index) => (
                                        <div
                                            key={index}
                                            className="mm__suggestion"
                                            onClick={() => {
                                                setBusca(sugestao);
                                                setShowSugestoes(false);
                                            }}
                                        >
                                            {sugestao}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Info dos mapas mentais */}
                {shouldShowMaps && (
                    <div className="mm__maps-info">
                        <div className="mm__maps-info__left">
                            <span>Exibindo {total} mapas mentais</span>
                        </div>
                    </div>
                )}

                {/* Lista de mapas mentais */}
                {shouldShowMaps ? (
                    <div className="mm__grid" style={{ '--mm-cols': columns }}>
                        {mapasMentais.map((mapa, index) => {
                            let nomeExibicao = mapa.nome_arquivo
                                .replace(/^Mapa Mental - /i, '')
                                .replace(/\.pdf$/i, '')
                                .replace(/^\d+\s*-\s*/, '')
                                .trim();

                            const previewPath = `mapas_mentais/download/${pathToUrl(mapa.caminho || '')}/`;
                            const previewLink = `${API_BASE}${previewPath}?download=0`;
                            const downloadUrl = `${API_BASE}${previewPath}`;

                            // Debug mantido (não altera visual)
                            console.log('Dados do mapa:', {
                                id: mapa.id,
                                nome: mapa.nome_arquivo,
                                caminho: mapa.caminho,
                                caminhoTipo: typeof mapa.caminho,
                                caminhoVazio: !mapa.caminho,
                                previewPath,
                                fullUrl: `${API_BASE}${previewPath}?download=0`,
                                mapaCompleto: mapa,
                            });

                            // Cores do card
                            const cardColor = CARD_COLORS[index % CARD_COLORS.length];

                            return (
                                <div
                                    key={mapa.id}
                                    className="mm__card"
                                    style={{ '--mm-accent': cardColor.accent, '--mm-icon': cardColor.icon }}
                                    onClick={() => {}}
                                >
                                    {/* Barra superior do card */}
                                    <div className="mm__card-accent" />

                                    {/* Ícone principal */}
                                    <div className="mm__card-icon">
                                        <Network size={32} color={cardColor.icon} strokeWidth={2} />
                                    </div>

                                    {/* Título */}
                                    <div className="mm__card-title">{nomeExibicao}</div>

                                    {/* Ações */}
                                    <div className="mm__actions-row">
                                        <button
                                            type="button"
                                            className="mm__btn mm__btn--eye"
                                            onClick={() => openPreview(previewPath)}
                                            title="Pré-visualizar"
                                        >
                                            <Eye size={isMobile ? 20 : 18} strokeWidth={2.5} />
                                        </button>

                                        <a
                                            className="mm__btn mm__btn--download"
                                            href={downloadUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            title="Baixar"
                                            onClick={() => addToast('Download iniciado!', 'success')}
                                        >
                                            <Download size={isMobile ? 20 : 18} strokeWidth={2.5} />
                                        </a>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Loading */}
                        {loading && (
                            <div className="mm__loading">
                                <div className="mm__loading-text">
                                    <span className="mm__spinner" />
                                    Carregando mapas mentais...
                                </div>
                            </div>
                        )}

                        {/* Vazio (sem resultados) */}
                        {mapasMentais.length === 0 && !loading && (
                            <div className="mm__empty">
                                <div className="mm__empty-icon">
                                    <FileText size={56} color="white" strokeWidth={2} />
                                </div>

                                <h3 className="mm__empty-title">Nenhum mapa mental encontrado</h3>

                                <p className="mm__empty-desc">
                                    {busca
                                        ? `Não encontramos resultados para "${busca}". Tente ajustar os filtros ou usar termos diferentes.`
                                        : 'Parece que não há mapas mentais disponíveis no momento. Verifique os filtros selecionados.'}
                                </p>

                                <div className="mm__empty-suggestions">
                                    <div className="mm__empty-suggestions__title">
                                        <AlertCircle size={18} />
                                        Sugestões para encontrar mapas:
                                    </div>
                                    <ul className="mm__empty-suggestions__list">
                                        <li>• Verifique se os filtros estão corretos</li>
                                        <li>• Tente usar termos mais gerais na busca</li>
                                        <li>• Limpe os filtros para ver todos os mapas</li>
                                        <li>• Entre em contato com o suporte se o problema persistir</li>
                                    </ul>
                                </div>

                                <button
                                    type="button"
                                    className="mm__empty-button"
                                    onClick={() => {
                                        setBusca('');
                                        setComponenteSelecionado('');
                                        setSubcomponenteSelecionado('');
                                        addToast('Filtros limpos!', 'success');
                                    }}
                                >
                                    Limpar Filtros
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    // Estado quando não há filtros selecionados
                    <div className="mm__nofilters">
                        <div className="mm__nofilters-icon">
                            <Search size={56} color="white" />
                        </div>

                        <h3 className="mm__nofilters-title">Nenhum filtro selecionado</h3>

                        <p className="mm__nofilters-desc">
                            Selecione um componente curricular, área/tema ou use a busca para visualizar os mapas mentais disponíveis.
                        </p>
                    </div>
                )}

                {/* Paginação */}
                {shouldShowMaps && total > 0 && (
                    <>
                        <div className="mm__pagination">
                            {/* Quantidade por página */}
                            <div className="mm__page-size">
                                <span>Quantidade por página:</span>
                                <select
                                    value={pageSize}
                                    onChange={(e) => setPageSize(parseInt(e.target.value))}
                                    onFocus={(e) => {}}
                                    onBlur={(e) => {}}
                                >
                                    {PAGE_SIZES.map(size => (
                                        <option key={size} value={size}>{size}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Navegação */}
                            <div className="mm__pager">
                                <button
                                    type="button"
                                    className="mm__pager-btn"
                                    onClick={() => loadPage(1)}
                                    disabled={page <= 1 || loading}
                                    title="Primeira página"
                                >
                                    &#171;&#171;
                                </button>

                                <button
                                    type="button"
                                    className="mm__pager-btn"
                                    onClick={() => loadPage(page - 1)}
                                    disabled={page <= 1 || loading}
                                    title="Página anterior"
                                >
                                    &#171;
                                </button>

                                <div className="mm__page-indicator">
                                    {page} de {Math.ceil(total / pageSize)}
                                </div>

                                <button
                                    type="button"
                                    className="mm__pager-btn"
                                    onClick={() => loadPage(page + 1)}
                                    disabled={page >= Math.ceil(total / pageSize) || loading}
                                    title="Próxima página"
                                >
                                    &#187;
                                </button>

                                <button
                                    type="button"
                                    className="mm__pager-btn"
                                    onClick={() => loadPage(Math.ceil(total / pageSize))}
                                    disabled={page >= Math.ceil(total / pageSize) || loading}
                                    title="Última página"
                                >
                                    &#187;&#187;
                                </button>
                            </div>

                            {/* Total */}
                            <div className="mm__total-info">
                                Total: <strong>{total}</strong> mapas mentais
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Modal de Preview */}
            {previewOpen && (
                <div className="mm__overlay" onClick={closePreview}>
                    {console.log('Modal de preview renderizado, previewSrc:', previewSrc)}
                    <div className="mm__modal" onClick={(e) => e.stopPropagation()}>
                        <button
                            type="button"
                            className="mm__modal-close"
                            aria-label="Fechar pré-visualização"
                            onClick={closePreview}
                        >
                            <LucideX size={24} />
                        </button>
                        <iframe
                            className="mm__modal-iframe"
                            src={previewSrc}
                            title="Pré-visualização do mapa mental"
                            onLoad={() => console.log('Iframe carregado com sucesso')}
                            onError={(e) => console.error('Erro ao carregar iframe:', e)}
                        />
                    </div>
                </div>
            )}

            {/* Toasts */}
            <div className="mm__toasts">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        className={`mm__toast mm__toast--${toast.type || 'info'}`}
                        role="status"
                    >
                        <div className="mm__toast-icon">
                            {toast.type === 'success' && <CheckCircle size={20} />}
                            {toast.type === 'error' && <AlertCircle size={20} />}
                            {toast.type === 'info' && <AlertCircle size={20} />}
                        </div>
                        <span className="mm__toast-message">{toast.message}</span>
                        <button
                            type="button"
                            className="mm__toast-close"
                            onClick={() => removeToast(toast.id)}
                            aria-label="Fechar notificação"
                            title="Fechar"
                        >
                            <LucideX size={16} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
