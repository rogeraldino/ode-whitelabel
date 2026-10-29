import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import { Edit3, Search, FolderOpen, PlusCircle, Archive, Trash2, LayoutGrid, List, X, Download, Calendar, BookOpen, Users, Clock, Filter, SortAsc, SortDesc } from 'lucide-react';
import '../style/perfilPage.css';
import { useNavigate, Link } from 'react-router-dom';
import {
  apagarLista,
  buscarListasApi,
  arquivarLista,
  desarquivarLista,
  baixarUltimoModelo,
  baixarUltimaSolucao,
  listarMeusPlanos,
  listarMeusResumos,
  arquivarPlano,
  desarquivarPlano,
  deletarPlano,
  baixarPlano,
  arquivarResumo,
  desarquivarResumo,
  deletarResumo,
  baixarResumo,
} from "../services/Api.jsx";
import ConfirmModal from '../components/modals/ConfirmModal';


export default function PerfilPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [usuario, setUsuario] = useState('');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [disciplina] = useState('Matemática');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({ email: '', password: '' });
  const [isValid, setIsValid] = useState(false);
  const [listas, setListas] = useState([]);
  const [listasLoading, setListasLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [listaParaDeletar, setListaParaDeletar] = useState(null);
  const [busca, setBusca] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedCount, setArchivedCount] = useState(0);
  const [planos, setPlanos] = useState([]);
  const [planosLoading, setPlanosLoading] = useState(true);
  const [resumos, setResumos] = useState([]);
  const [resumosLoading, setResumosLoading] = useState(true);
  const [archivingItem, setArchivingItem] = useState(null); // Para mostrar loading no botão
  const [showArchiveFeedback, setShowArchiveFeedback] = useState(false); // Para mostrar feedback
  
  // Estados para melhorias
  const [sortBy, setSortBy] = useState('data_criacao'); // data_criacao, nome, dificuldade, quantidade_questoes
  const [sortOrder, setSortOrder] = useState('desc'); // asc, desc
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    disciplina: '',
    anoEscolar: '',
    dificuldade: '',
    status: ''
  });
  
  // Estados para ações em lote
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkAction, setBulkAction] = useState('');


  useEffect(() => {
    if (!user) return;
    setUsuario(user.usuario || '');
    setNome(user.nome || '');
    setEmail(user.email || '');
    setTelefone(user.telefone || '(62) 99999-9999');
  }, [user]);

  useEffect(() => {
    let emailErr = '';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) emailErr = 'E-mail inválido';
    let pwdErr = '';
    if ((newPassword || confirmPassword) && newPassword !== confirmPassword)
      pwdErr = 'Senhas não coincidem';
    setErrors({ email: emailErr, password: pwdErr });
    setIsValid(
        nome.trim() !== '' &&
        emailErr === '' &&
        (newPassword || confirmPassword ? pwdErr === '' : true)
    );
  }, [nome, email, newPassword, confirmPassword]);

  // Função debounce para a busca
  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  // -------------- debounce --------------
  const debouncedSearch = useMemo(() =>
          debounce(async (term, archived) => {
            setIsSearching(true);
            try {
              const data = await buscarListasApi(term, archived); // <-- passa o flag!
              setListas(data);
              if (archived) {
                setArchivedCount(data.length);
              }
            } finally {
              setIsSearching(false);
              setListasLoading(false);
            }
          }, 500)
      , []);

  useEffect(() => {
    // quando alternar Ativos/Arquivados, refaz a última busca
    setListasLoading(true);
    debouncedSearch(busca, showArchived);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showArchived]);

  useEffect(() => {
    const carregarPlanos = async () => {
      setPlanosLoading(true);
      try {
        const data = await listarMeusPlanos(showArchived);
        setPlanos(data);
      } catch (err) {
        console.error('Erro ao carregar planos:', err);
      } finally {
        setPlanosLoading(false);
      }
    };
    carregarPlanos();
  }, [showArchived]);

  useEffect(() => {
    const carregarResumos = async () => {
      setResumosLoading(true);
      try {
        const data = await listarMeusResumos(showArchived);
        setResumos(data);
      } catch (err) {
        console.error('Erro ao carregar resumos:', err);
      } finally {
        setResumosLoading(false);
      }
    };
    carregarResumos();
  }, [showArchived]);

  useEffect(() => {
    if (!showArchived) {
      buscarListasApi('', true)
          .then(data => setArchivedCount(data.length))
          .catch(() => {});
    }
  }, [showArchived]);

  // Carregar listas iniciais
  useEffect(() => {
    if (user) {
      setListasLoading(true);
      debouncedSearch('', showArchived);
    }
  }, [user, showArchived]);

  const generateInitials = (name) => {
    const parts = name?.trim().split(' ').filter(Boolean) || [];
    if (parts.length === 0) return '?';
    return (
        parts[0][0].toUpperCase() +
        (parts[1] ? parts[1][0].toUpperCase() : '')
    );
  };

  const handleDeleteClick = (listaUuid) => {
    setListaParaDeletar(listaUuid);
    setIsModalOpen(true);
  };

  const confirmDelete = async () => {
    if (listaParaDeletar) {
      try {
        await apagarLista(listaParaDeletar);
        setListas(listas.filter(lista => lista.uuid !== listaParaDeletar));
        setListaParaDeletar(null);
        setIsModalOpen(false);
      } catch (error) {
        console.error("Erro ao apagar a lista:", error);
        // Adicionar um feedback para o usuário aqui seria uma boa ideia
      }
    }
  };


  const getDifficultyClass = (dif) => {
    const d = dif?.toLowerCase();
    if (d === 'fácil' || d === 'facil') return 'dificuldade-facil';
    if (d === 'médio' || d === 'medio') return 'dificuldade-medio';
    if (d === 'difícil' || d === 'dificil') return 'dificuldade-dificil';
    return '';
  };

  const handleClearSearch = () => {
    setBusca("");
    setListasLoading(true);
    debouncedSearch("", showArchived);
  };

  const handleToggleArchived = () => {
    setBusca(""); // Limpa a busca ao trocar de modo
    setShowArchived(!showArchived);
  };

  const handleArchiveClick = async (listaUuid) => {
    try {
      setArchivingItem(listaUuid); // Mostra loading no botão
      
      if (showArchived) {
        // Se está mostrando arquivados, então desarquiva
        await desarquivarLista(listaUuid);
        setListas(listas.filter(lista => lista.uuid !== listaUuid));
        setArchivedCount(count => count - 1);
        setShowArchiveFeedback(true);
        setTimeout(() => setShowArchiveFeedback(false), 3000); // Esconde feedback após 3s
      } else {
        // Se está mostrando ativos, então arquiva
        await arquivarLista(listaUuid);
        setListas(listas.filter(lista => lista.uuid !== listaUuid));
        setArchivedCount(count => count + 1);
        setShowArchiveFeedback(true);
        setTimeout(() => setShowArchiveFeedback(false), 3000); // Esconde feedback após 3s
      }
    } catch (error) {
      console.error("Erro ao arquivar/desarquivar a lista:", error);
      // Adicionar um feedback para o usuário aqui seria uma boa ideia
    } finally {
      setArchivingItem(null); // Remove loading do botão
    }
  };

  const handleArchivePlano = async (uuid) => {
    try {
      setArchivingItem(`plano-${uuid}`); // Mostra loading no botão
      if (showArchived) {
        await desarquivarPlano(uuid);
      } else {
        await arquivarPlano(uuid);
      }
      setPlanos(planos.filter(p => p.uuid !== uuid));
      setShowArchiveFeedback(true);
      setTimeout(() => setShowArchiveFeedback(false), 3000);
    } catch (err) {
      console.error(`Erro ao ${showArchived ? 'desarquivar' : 'arquivar'} plano:`, err);
    } finally {
      setArchivingItem(null);
    }
  };

  const handleDeletePlano = async (uuid) => {
    if (!window.confirm('Excluir este plano?')) return;
    try {
      await deletarPlano(uuid);
      setPlanos(planos.filter(p => p.uuid !== uuid));
    } catch (err) {
      console.error('Erro ao excluir plano:', err);
    }
  };

  const handleDownloadPlanoClick = async (plano) => {
    try {
      const resp = await baixarPlano(plano.uuid);
      const url = URL.createObjectURL(resp.data || resp);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${plano.nome}.docx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erro ao baixar plano:', err);
    }
  };

  const handleArchiveResumo = async (uuid) => {
    try {
      setArchivingItem(`resumo-${uuid}`); // Mostra loading no botão
      if (showArchived) {
        await desarquivarResumo(uuid);
      } else {
        await arquivarResumo(uuid);
      }
      setResumos(resumos.filter(r => r.uuid !== uuid));
      setShowArchiveFeedback(true);
      setTimeout(() => setShowArchiveFeedback(false), 3000);
    } catch (err) {
      console.error(`Erro ao ${showArchived ? 'desarquivar' : 'arquivar'} resumo:`, err);
    } finally {
      setArchivingItem(null);
    }
  };

  const handleDeleteResumo = async (uuid) => {
    if (!window.confirm('Excluir este resumo?')) return;
    try {
      await deletarResumo(uuid);
      setResumos(resumos.filter(r => r.uuid !== uuid));
    } catch (err) {
      console.error('Erro ao excluir resumo:', err);
    }
  };

  const handleDownloadResumoClick = async (resumo) => {
    try {
      const resp = await baixarResumo(resumo.uuid);
      const url = URL.createObjectURL(resp.data || resp);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${resumo.nome_documento}.docx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erro ao baixar resumo:', err);
    }
  };

  // Funções para ordenação e filtros
  const sortListas = (listas) => {
    return [...listas].sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'nome':
          aValue = a.nome?.toLowerCase() || '';
          bValue = b.nome?.toLowerCase() || '';
          break;
        case 'dificuldade':
          const dificuldadeOrder = { 'fácil': 1, 'médio': 2, 'difícil': 3 };
          aValue = dificuldadeOrder[a.dificuldade?.toLowerCase()] || 0;
          bValue = dificuldadeOrder[b.dificuldade?.toLowerCase()] || 0;
          break;
        case 'quantidade_questoes':
          aValue = a.quantidade_questoes || 0;
          bValue = b.quantidade_questoes || 0;
          break;
        case 'data_criacao':
        default:
          aValue = new Date(a.data_criacao || a.created_at || 0);
          bValue = new Date(b.data_criacao || b.created_at || 0);
          break;
      }
      
      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const filterListas = (listas) => {
    return listas.filter(lista => {
      if (filters.disciplina && lista.componente !== filters.disciplina) return false;
      if (filters.anoEscolar && lista.ano_escolar !== filters.anoEscolar) return false;
      if (filters.dificuldade && lista.dificuldade?.toLowerCase() !== filters.dificuldade.toLowerCase()) return false;
      if (filters.status && lista.status !== filters.status) return false;
      return true;
    });
  };

  const handleSortChange = (newSortBy) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('asc');
    }
  };

  const clearFilters = () => {
    setFilters({
      disciplina: '',
      anoEscolar: '',
      dificuldade: '',
      status: ''
    });
  };

  // Listas processadas com ordenação e filtros
  const processedListas = useMemo(() => {
    const filtered = filterListas(listas);
    return sortListas(filtered);
  }, [listas, sortBy, sortOrder, filters]);

  // Funções para ações em lote
  const toggleItemSelection = (itemUuid) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemUuid)) {
        newSet.delete(itemUuid);
      } else {
        newSet.add(itemUuid);
      }
      return newSet;
    });
  };

  const selectAllItems = () => {
    setSelectedItems(new Set(processedListas.map(item => item.uuid)));
  };

  const clearSelection = () => {
    setSelectedItems(new Set());
  };

  const handleBulkAction = async (action) => {
    if (selectedItems.size === 0) return;

    const itemsToProcess = Array.from(selectedItems);
    const confirmMessage = action === 'delete' 
      ? `Tem certeza que deseja excluir ${itemsToProcess.length} lista(s)?`
      : `Tem certeza que deseja ${action === 'archive' ? 'arquivar' : 'desarquivar'} ${itemsToProcess.length} lista(s)?`;

    if (!window.confirm(confirmMessage)) return;

    try {
      setArchivingItem('bulk');
      
      for (const uuid of itemsToProcess) {
        if (action === 'delete') {
          await apagarLista(uuid);
        } else if (action === 'archive') {
          if (showArchived) {
            await desarquivarLista(uuid);
          } else {
            await arquivarLista(uuid);
          }
        }
      }

      // Atualizar a lista removendo os itens processados
      setListas(prev => prev.filter(lista => !itemsToProcess.includes(lista.uuid)));
      
      // Limpar seleção e sair do modo bulk
      clearSelection();
      setIsBulkMode(false);
      setShowArchiveFeedback(true);
      setTimeout(() => setShowArchiveFeedback(false), 3000);
      
    } catch (error) {
      console.error(`Erro ao executar ação em lote:`, error);
    } finally {
      setArchivingItem(null);
    }
  };

  const toggleBulkMode = () => {
    setIsBulkMode(!isBulkMode);
    if (isBulkMode) {
      clearSelection();
    }
  };

  const handleDownloadClick = async (lista) => {
    try {
      const resp = await baixarUltimoModelo(lista.uuid);
      const url = URL.createObjectURL(resp.data || resp);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${lista.nome}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      const respSol = await baixarUltimaSolucao(lista.uuid);
      const urlSol = URL.createObjectURL(respSol.data || respSol);
      const linkSol = document.createElement('a');
      linkSol.href = urlSol;
      linkSol.download = `Resolução ${lista.nome}.pdf`;
      document.body.appendChild(linkSol);
      linkSol.click();
      linkSol.remove();
      URL.revokeObjectURL(urlSol);
    } catch (error) {
      console.error('Erro ao baixar PDF:', error);
    }
  };


  if (loading) return <div>Carregando...</div>;

  return (
      <div className="page-wrapper compact">
        <div className="perfil-container compact">
          <div className="perfil-header-row">
            <div className="perfil-avatar">
              <div className="avatar-initials">{generateInitials(usuario)}</div>
            </div>
            <div className="perfil-details">
              <div className="perfil-name">
                <div className="detail-icon" />
                <h3>Prof. {nome}</h3>
              </div>
              <div className="perfil-contact">
                <div className="detail-item detail-email">
                  <div className="detail-icon" />
                  <span>{email}</span>
                </div>
                <div className="detail-item detail-phone">
                  <div className="detail-icon" />
                  <span>{telefone}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="perfil-filtros-row">
            <div className={`filtro-box ${busca ? 'has-value' : ''} ${isSearching ? 'is-loading' : ''}`}>
              <Search size={18} />
              <input
                type="text"
                placeholder={showArchived ? "Buscar em itens arquivados..." : "Buscar por título, série, habilidade..."}
                value={busca}
                onChange={e => {
                  const value = e.target.value;
                  setBusca(value);
                  setListasLoading(true);
                  debouncedSearch(value, showArchived);  // importante!
                }}
                aria-label="Campo de busca"
              />
              {!isSearching && busca && (
                <button
                  className="clear-search"
                  onClick={handleClearSearch}
                  aria-label="Limpar busca"
                >
                  <X size={18} />
                </button>
              )}
              <div className="search-loader" role="status" aria-label="Buscando..."></div>
            </div>
            <div className="view-controls">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`filter-toggle ${showFilters ? 'active' : ''}`}
                aria-label="Mostrar filtros"
              >
                <Filter size={16} />
                <span>Filtros</span>
              </button>
              <button
                onClick={toggleBulkMode}
                className={`bulk-toggle ${isBulkMode ? 'active' : ''}`}
                aria-label="Modo de seleção múltipla"
              >
                <Users size={16} />
                <span>Selecionar</span>
              </button>
              <button
                onClick={handleToggleArchived}
                className={`archive-toggle ${showArchived ? 'active' : ''}`}
                aria-label={showArchived ? "Mostrar itens ativos" : "Mostrar itens arquivados"}
              >
                <Archive size={16} />
                <span>Arquivados</span>
                {archivedCount > 0 && <span className="archive-badge">{archivedCount}</span>}
              </button>
              <div className="view-switcher">
                <button onClick={() => setViewMode('grid')} className={viewMode === 'grid' ? 'active' : ''} title="Visão em Grade">
                  <LayoutGrid size={20} />
                </button>
                <button onClick={() => setViewMode('list')} className={viewMode === 'list' ? 'active' : ''} title="Visão em Lista">
                  <List size={20} />
                </button>
              </div>
            </div>
          </div>

          {/* Painel de Filtros */}
          {showFilters && (
            <div className="filters-panel">
              <div className="filters-grid">
                <div className="filter-group">
                  <label>Disciplina</label>
                  <select 
                    value={filters.disciplina} 
                    onChange={(e) => setFilters(prev => ({ ...prev, disciplina: e.target.value }))}
                  >
                    <option value="">Todas</option>
                    <option value="Matemática">Matemática</option>
                    <option value="Português">Português</option>
                    <option value="História">História</option>
                    <option value="Geografia">Geografia</option>
                    <option value="Ciências">Ciências</option>
                    <option value="Física">Física</option>
                    <option value="Química">Química</option>
                    <option value="Biologia">Biologia</option>
                  </select>
                </div>
                <div className="filter-group">
                  <label>Ano Escolar</label>
                  <select 
                    value={filters.anoEscolar} 
                    onChange={(e) => setFilters(prev => ({ ...prev, anoEscolar: e.target.value }))}
                  >
                    <option value="">Todos</option>
                    <option value="1º Ano">1º Ano</option>
                    <option value="2º Ano">2º Ano</option>
                    <option value="3º Ano">3º Ano</option>
                    <option value="4º Ano">4º Ano</option>
                    <option value="5º Ano">5º Ano</option>
                    <option value="6º Ano">6º Ano</option>
                    <option value="7º Ano">7º Ano</option>
                    <option value="8º Ano">8º Ano</option>
                    <option value="9º Ano">9º Ano</option>
                    <option value="1ª Série">1ª Série</option>
                    <option value="2ª Série">2ª Série</option>
                    <option value="3ª Série">3ª Série</option>
                  </select>
                </div>
                <div className="filter-group">
                  <label>Dificuldade</label>
                  <select 
                    value={filters.dificuldade} 
                    onChange={(e) => setFilters(prev => ({ ...prev, dificuldade: e.target.value }))}
                  >
                    <option value="">Todas</option>
                    <option value="fácil">Fácil</option>
                    <option value="médio">Médio</option>
                    <option value="difícil">Difícil</option>
                  </select>
                </div>
                <div className="filter-group">
                  <label>Status</label>
                  <select 
                    value={filters.status} 
                    onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                  >
                    <option value="">Todos</option>
                    <option value="salva">Salva</option>
                    <option value="rascunho">Rascunho</option>
                  </select>
                </div>
              </div>
              <div className="filters-actions">
                <button onClick={clearFilters} className="btn-clear-filters">
                  Limpar Filtros
                </button>
              </div>
            </div>
          )}

          {/* Controles de Ordenação */}
          <div className="sort-controls">
            <span className="sort-label">Ordenar por:</span>
            <div className="sort-buttons">
              <button 
                onClick={() => handleSortChange('data_criacao')}
                className={`sort-btn ${sortBy === 'data_criacao' ? 'active' : ''}`}
              >
                <Calendar size={16} />
                Data
                {sortBy === 'data_criacao' && (sortOrder === 'asc' ? <SortAsc size={14} /> : <SortDesc size={14} />)}
              </button>
              <button 
                onClick={() => handleSortChange('nome')}
                className={`sort-btn ${sortBy === 'nome' ? 'active' : ''}`}
              >
                <BookOpen size={16} />
                Nome
                {sortBy === 'nome' && (sortOrder === 'asc' ? <SortAsc size={14} /> : <SortDesc size={14} />)}
              </button>
              <button 
                onClick={() => handleSortChange('dificuldade')}
                className={`sort-btn ${sortBy === 'dificuldade' ? 'active' : ''}`}
              >
                <Users size={16} />
                Dificuldade
                {sortBy === 'dificuldade' && (sortOrder === 'asc' ? <SortAsc size={14} /> : <SortDesc size={14} />)}
              </button>
              <button 
                onClick={() => handleSortChange('quantidade_questoes')}
                className={`sort-btn ${sortBy === 'quantidade_questoes' ? 'active' : ''}`}
              >
                <Clock size={16} />
                Questões
                {sortBy === 'quantidade_questoes' && (sortOrder === 'asc' ? <SortAsc size={14} /> : <SortDesc size={14} />)}
              </button>
            </div>
          </div>

          {/* Painel de Ações em Lote */}
          {isBulkMode && (
            <div className="bulk-actions-panel">
              <div className="bulk-actions-info">
                <span className="bulk-selection-count">
                  {selectedItems.size} de {processedListas.length} selecionado(s)
                </span>
                <div className="bulk-actions-buttons">
                  <button 
                    onClick={selectAllItems}
                    className="btn-select-all"
                    disabled={selectedItems.size === processedListas.length}
                  >
                    Selecionar Todos
                  </button>
                  <button 
                    onClick={clearSelection}
                    className="btn-clear-selection"
                    disabled={selectedItems.size === 0}
                  >
                    Limpar Seleção
                  </button>
                </div>
              </div>
              <div className="bulk-actions-main">
                <button 
                  onClick={() => handleBulkAction('archive')}
                  className="btn-bulk-archive"
                  disabled={selectedItems.size === 0 || archivingItem === 'bulk'}
                >
                  {archivingItem === 'bulk' ? (
                    <div className="loading-spinner"></div>
                  ) : (
                    <Archive size={16} />
                  )}
                  {showArchived ? 'Desarquivar Selecionados' : 'Arquivar Selecionados'}
                </button>
                <button 
                  onClick={() => handleBulkAction('delete')}
                  className="btn-bulk-delete"
                  disabled={selectedItems.size === 0 || archivingItem === 'bulk'}
                >
                  <Trash2 size={16} />
                  Excluir Selecionados
                </button>
              </div>
            </div>
          )}
          
          {/* Feedback de arquivamento */}
          {showArchiveFeedback && (
            <div className="archive-feedback">
              <span className="archive-feedback-text">
                {showArchived ? "Lista desarquivada com sucesso!" : "Lista arquivada com sucesso!"}
              </span>
            </div>
          )}
          
          <h3 className="secao-titulo">Listas de Atividade</h3>
          <div>
            {listasLoading ? (
                <div className="perfil-vazio">
                  Carregando suas listas...
                </div>
            ) : processedListas.length === 0 ? (
                <div className="perfil-vazio">
                  <FolderOpen size={48} />
                  <p>Nenhuma lista encontrada</p>
                  {Object.values(filters).some(f => f) && (
                    <p className="empty-filters-message">
                      Tente ajustar os filtros para ver mais resultados.
                    </p>
                  )}

                  <div className="perfil-vazio-addbtn">
                    <Link to="/gerar-atividades" className="btn-criar-lista">
                      <PlusCircle /> Criar nova lista
                    </Link>
                  </div>
                </div>
            ) : (
                <div className="perfil-catalogo-listas">
                  {viewMode === 'grid' ? (
                    <div className="listas-grid">
                      {processedListas.map(lista => (
                          <div className={`lista-card ${isBulkMode ? 'bulk-mode' : ''} ${selectedItems.has(lista.uuid) ? 'selected' : ''}`} key={lista.uuid}>
                            {isBulkMode && (
                              <div className="card-checkbox">
                                <input
                                  type="checkbox"
                                  checked={selectedItems.has(lista.uuid)}
                                  onChange={() => toggleItemSelection(lista.uuid)}
                                  aria-label={`Selecionar ${lista.nome}`}
                                />
                              </div>
                            )}
                            <div className="card-header">
                              <div className="card-header-left">
                                <div className="bncc-codes">
                                  {lista.codigos_bncc?.slice(0, 2).map((codigo, idx) => (
                                    <span key={idx} className="badge-bncc">{codigo}</span>
                                  ))}
                                </div>
                                <span className={`lista-status lista-status-${lista.status}`}>
                                  {lista.status === "salva" ? "Salva" : "Rascunho"}
                                </span>
                              </div>
                              {!isBulkMode && (
                                <button
                                  className="btn-download-modelo"
                                  title="Baixar modelo"
                                  onClick={() => handleDownloadClick(lista)}
                                >
                                  <Download size={18} />
                                </button>
                              )}
                            </div>
                            
                            <div className="card-content">
                              <h4 className="lista-nome">{lista.nome}</h4>
                              
                              <div className="card-meta">
                                <div className="meta-item">
                                  <BookOpen size={14} />
                                  <span>{lista.componente || 'Matemática'}</span>
                                </div>
                                {lista.ano_escolar && (
                                  <div className="meta-item">
                                    <Users size={14} />
                                    <span>{lista.ano_escolar}</span>
                                  </div>
                                )}
                                <div className="meta-item">
                                  <Calendar size={14} />
                                  <span>{new Date(lista.data_criacao || lista.created_at).toLocaleDateString('pt-BR')}</span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="card-footer">
                              <div className="lista-info">
                                <span className={`lista-dificuldade ${getDifficultyClass(lista.dificuldade)}`}>
                                  {lista.dificuldade || 'N/A'}
                                </span>
                                <span className="questoes-count">
                                  <Clock size={14} />
                                  {lista.quantidade_questoes ?? 0}{' '}
                                  {lista.quantidade_questoes === 1 ? 'Questão' : 'Questões'}
                                </span>
                              </div>
                              <div className="card-actions">
                                <button className="btn-edit-lista"
                                        onClick={() => navigate(`/editar-lista/${lista.uuid}`, { state: { listaUuid: lista.uuid } })}
                                        title="Editar lista"
                                >
                                  <Edit3 size={18} />
                                </button>
                                <button 
                                  className="btn-archive-lista" 
                                  title={showArchived ? "Desarquivar lista" : "Arquivar lista"} 
                                  onClick={() => handleArchiveClick(lista.uuid)}
                                  disabled={archivingItem === lista.uuid}
                                >
                                  {archivingItem === lista.uuid ? (
                                    <div className="loading-spinner"></div>
                                  ) : (
                                    <Archive size={18} />
                                  )}
                                </button>
                                <button className="btn-delete-lista" title="Excluir lista" onClick={() => handleDeleteClick(lista.uuid)}>
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            </div>
                          </div>
                      ))}
                    </div>
                  ) : (
                    <div className="listas-list">
                      {processedListas.map(lista => (
                        <div className={`lista-list-item ${isBulkMode ? 'bulk-mode' : ''} ${selectedItems.has(lista.uuid) ? 'selected' : ''}`} key={lista.uuid}>
                          {isBulkMode && (
                            <div className="list-item-checkbox">
                              <input
                                type="checkbox"
                                checked={selectedItems.has(lista.uuid)}
                                onChange={() => toggleItemSelection(lista.uuid)}
                                aria-label={`Selecionar ${lista.nome}`}
                              />
                            </div>
                          )}
                          <div className="list-item-main">
                            <h4 className="lista-nome">{lista.nome}</h4>
                            <div className="lista-info">
                                <span>
                                  {lista.quantidade_questoes ?? 0}{' '}
                                  {lista.quantidade_questoes === 1 ? 'Questão' : 'Questões'}
                                </span>
                                <span className={`lista-dificuldade ${getDifficultyClass(lista.dificuldade)}`}>{lista.dificuldade}</span>
                                <span className={`lista-status lista-status-${lista.status}`}>{lista.status === "salva" ? "Salva" : "Rascunho"}</span>
                            </div>
                          </div>
                          {!isBulkMode && (
                            <div className="list-item-actions">
                              <button className="btn-edit-lista"
                                      onClick={() => navigate(`/editar-lista/${lista.uuid}`, { state: { listaUuid: lista.uuid } })}
                                      title="Editar lista"
                              >
                                <Edit3 size={18} />
                              </button>
                              <button 
                                className="btn-archive-lista" 
                                title={showArchived ? "Desarquivar lista" : "Arquivar lista"} 
                                onClick={() => handleArchiveClick(lista.uuid)}
                                disabled={archivingItem === lista.uuid}
                              >
                                {archivingItem === lista.uuid ? (
                                  <div className="loading-spinner"></div>
                                ) : (
                                  <Archive size={18} />
                                )}
                              </button>
                              <button className="btn-delete-lista" title="Excluir lista" onClick={() => handleDeleteClick(lista.uuid)}>
                                <Trash2 size={18} />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="perfil-catalogo-addbtn">
                    <Link to="/gerar-atividades" className="btn-criar-lista">
                      <PlusCircle /> Criar nova lista
                    </Link>
                  </div>
                </div>
            )}
          </div>
        </div>

        <div className="perfil-container compact">
          <h3 className="secao-titulo">Planos de Aula</h3>
          {planosLoading ? (
            <div className="perfil-vazio">Carregando...</div>
          ) : planos.length === 0 ? (
            <div className="perfil-vazio">
              <FolderOpen size={48} />
              <p>Nenhum plano encontrado</p>
              <div className="perfil-vazio-addbtn">
                <Link to="/plano-de-aula-gerador" className="btn-criar-lista">
                  <PlusCircle /> Criar novo plano
                </Link>
              </div>
            </div>
          ) : (
            <div className="perfil-catalogo-listas">
              <div className="listas-grid">
                {planos.map(plano => (
                  <div className="lista-card" key={plano.uuid}>
                    <div className="card-header">
                      <div className="bncc-codes">
                        {plano.codigos_bncc?.slice(0,2).map((c, idx) => (
                          <span key={idx} className="badge-bncc">{c}</span>
                        ))}
                      </div>
                      <button
                        className="btn-download-modelo"
                        title="Baixar plano"
                        onClick={() => handleDownloadPlanoClick(plano)}
                      >
                        <Download size={18} />
                      </button>
                    </div>
                    <h4 className="lista-nome">{plano.nome}</h4>
                    <div className="lista-info">
                      <span>{plano.ano_escolar}</span>
                      <span>{plano.componente_nome}</span>
                      <div className="card-actions">
                        <button
                          className="btn-archive-lista"
                          title={showArchived ? "Desarquivar plano" : "Arquivar plano"}
                          onClick={() => handleArchivePlano(plano.uuid)}
                          disabled={archivingItem === `plano-${plano.uuid}`}
                        >
                          {archivingItem === `plano-${plano.uuid}` ? (
                            <div className="loading-spinner"></div>
                          ) : (
                            <Archive size={18} />
                          )}
                        </button>
                        <button className="btn-delete-lista" title="Excluir plano" onClick={() => handleDeletePlano(plano.uuid)}>
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="perfil-container compact">
          <h3 className="secao-titulo">Resumos</h3>
          {resumosLoading ? (
            <div className="perfil-vazio">Carregando...</div>
          ) : resumos.length === 0 ? (
            <div className="perfil-vazio">
              <FolderOpen size={48} />
              <p>Nenhum resumo encontrado</p>
              <div className="perfil-vazio-addbtn">
                <Link to="/resumo" className="btn-criar-lista">
                  <PlusCircle /> Criar novo resumo
                </Link>
              </div>

            </div>
          ) : (
            <div className="perfil-catalogo-listas">
              <div className="listas-grid">
                {resumos.map(resumo => (
                  <div className="lista-card" key={resumo.uuid}>
                    <div className="card-header">
                      <div className="bncc-codes">
                        {resumo.codigos_bncc?.slice(0,2).map((c, idx) => (
                          <span key={idx} className="badge-bncc">{c}</span>
                        ))}
                      </div>
                      <button
                        className="btn-download-modelo"
                        title="Baixar resumo"
                        onClick={() => handleDownloadResumoClick(resumo)}
                      >
                        <Download size={18} />
                      </button>
                    </div>
                    <h4 className="lista-nome">{resumo.nome_documento}</h4>
                    <div className="lista-info">
                      <span>{resumo.assunto}</span>
                      <div className="card-actions">
                        <button
                          className="btn-archive-lista"
                          title={showArchived ? "Desarquivar resumo" : "Arquivar resumo"}
                          onClick={() => handleArchiveResumo(resumo.uuid)}
                          disabled={archivingItem === `resumo-${resumo.uuid}`}
                        >
                          {archivingItem === `resumo-${resumo.uuid}` ? (
                            <div className="loading-spinner"></div>
                          ) : (
                            <Archive size={18} />
                          )}
                        </button>
                        <button className="btn-delete-lista" title="Excluir resumo" onClick={() => handleDeleteResumo(resumo.uuid)}>
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <ConfirmModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onConfirm={confirmDelete}
          title="Confirmar Exclusão"
          message="Você tem certeza que deseja excluir esta lista? Esta ação não pode ser desfeita."
          confirmText="Excluir"
        />
      </div>
  );
}
