import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import { 
  Search, Plus, Edit2, Trash2, Key, Users, Shield, 
  X, Check, AlertCircle, Loader2, Filter, XCircle, Calendar
} from 'lucide-react';
import '../style/adminUsuariosPage.css';
import {
  listarUsuariosAdmin,
  criarUsuarioAdmin,
  atualizarUsuarioAdmin,
  excluirUsuarioAdmin,
  gerenciarComponentesUsuario,
  redefinirSenhaUsuario,
  adicionarMesesAcesso,
  listarComponentesAdmin,
  listarPerfisAdmin,
} from '../services/Api.jsx';
import ConfirmModal from '../components/modals/ConfirmModal';

export default function AdminUsuariosPage() {
  const { user } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroAtivo, setFiltroAtivo] = useState('todos'); // todos, ativos, inativos
  
  // Estados para modais
  const [modalAberto, setModalAberto] = useState(null); // 'criar', 'editar', 'excluir', 'componentes', 'senha', 'meses'
  const [usuarioSelecionado, setUsuarioSelecionado] = useState(null);
  const [confirmacaoAberta, setConfirmacaoAberta] = useState(false);
  const [acaoConfirmacao, setAcaoConfirmacao] = useState(null);
  const [mesesAcesso, setMesesAcesso] = useState('');
  
  // Estados para formulários
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    usuario: '',
    telefone: '',
    tipo_documento: 'CPF',
    documento: '',
    plano: '',
    is_active: true,
    perfil_id: null,
    componentes_ids: [],
    senha: '',
  });
  
  const [componentesDisponiveis, setComponentesDisponiveis] = useState([]);
  const [perfisDisponiveis, setPerfisDisponiveis] = useState([]);
  const [erros, setErros] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');

  // Verificar se usuário tem permissão de administrador
  useEffect(() => {
    if (user && !user.funcionalidades?.includes('administrador')) {
      // Redirecionar se não for administrador
      window.location.href = '/';
    }
  }, [user]);

  // Carregar dados iniciais
  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const [usuariosData, componentesData, perfisData] = await Promise.all([
        listarUsuariosAdmin(),
        listarComponentesAdmin(),
        listarPerfisAdmin(),
      ]);
      setUsuarios(usuariosData);
      setComponentesDisponiveis(componentesData);
      setPerfisDisponiveis(perfisData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      mostrarToast('Erro ao carregar dados', 'error');
    } finally {
      setLoading(false);
    }
  };

  const mostrarToast = (mensagem, tipo = 'success') => {
    // Implementação simples de toast
    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    toast.textContent = mensagem;
    toast.style.cssText = `
      position: fixed;
      top: 2rem;
      right: 2rem;
      padding: 1rem 1.5rem;
      border-radius: 8px;
      box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
      z-index: 2000;
      font-weight: 500;
      animation: slideIn 0.3s ease;
      ${tipo === 'success' 
        ? 'background-color: #E6F4EA; color: #1E8E3E;' 
        : 'background-color: #FEE2E2; color: #DC2626;'
      }
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  };

  // Filtrar usuários
  const usuariosFiltrados = usuarios.filter(u => {
    const matchBusca = !busca || 
      u.nome?.toLowerCase().includes(busca.toLowerCase()) ||
      u.email?.toLowerCase().includes(busca.toLowerCase()) ||
      u.usuario?.toLowerCase().includes(busca.toLowerCase());
    
    const matchFiltro = filtroAtivo === 'todos' ||
      (filtroAtivo === 'ativos' && u.is_active) ||
      (filtroAtivo === 'inativos' && !u.is_active);
    
    return matchBusca && matchFiltro;
  });

  // Abrir modal de criar
  const abrirModalCriar = () => {
    setFormData({
      nome: '',
      email: '',
      usuario: '',
      telefone: '',
      tipo_documento: 'CPF',
      documento: '',
      plano: '',
      is_active: true,
      perfil_id: null,
      componentes_ids: [],
      senha: '',
    });
    setErros({});
    setModalAberto('criar');
  };

  // Abrir modal de editar
  const abrirModalEditar = (usuario) => {
    setUsuarioSelecionado(usuario);
    setFormData({
      nome: usuario.nome || '',
      email: usuario.email || '',
      usuario: usuario.usuario || '',
      telefone: usuario.telefone || '',
      tipo_documento: usuario.tipo_documento || 'CPF',
      documento: usuario.documento || '',
      plano: usuario.plano || '',
      is_active: usuario.is_active !== undefined ? usuario.is_active : true,
      perfil_id: usuario.perfil_id || null,
      componentes_ids: usuario.componentes?.map(c => c.id) || [],
      senha: '',
    });
    setErros({});
    setModalAberto('editar');
  };

  // Abrir modal de componentes
  const abrirModalComponentes = (usuario) => {
    setUsuarioSelecionado(usuario);
    setFormData({
      componentes_ids: usuario.componentes?.map(c => c.id) || [],
    });
    setModalAberto('componentes');
  };

  // Abrir modal de senha
  const abrirModalSenha = (usuario) => {
    setUsuarioSelecionado(usuario);
    setNovaSenha('');
    setConfirmarSenha('');
    setErros({});
    setModalAberto('senha');
  };

  // Abrir modal de meses
  const abrirModalMeses = (usuario) => {
    setUsuarioSelecionado(usuario);
    setMesesAcesso('');
    setErros({});
    setModalAberto('meses');
  };

  // Salvar usuário (criar ou editar)
  const salvarUsuario = async () => {
    setErros({});
    const novosErros = {};

    if (!formData.nome.trim()) novosErros.nome = 'Nome é obrigatório';
    if (!formData.email.trim()) novosErros.email = 'Email é obrigatório';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) novosErros.email = 'Email inválido';
    
    if (modalAberto === 'criar') {
      if (!formData.senha) novosErros.senha = 'Senha é obrigatória';
      else if (formData.senha.length < 6) novosErros.senha = 'Senha deve ter no mínimo 6 caracteres';
    }

    if (Object.keys(novosErros).length > 0) {
      setErros(novosErros);
      return;
    }

    try {
      setSalvando(true);
      if (modalAberto === 'criar') {
        await criarUsuarioAdmin(formData);
        mostrarToast('Usuário criado com sucesso!', 'success');
      } else {
        await atualizarUsuarioAdmin(usuarioSelecionado.id, formData);
        mostrarToast('Usuário atualizado com sucesso!', 'success');
      }
      setModalAberto(null);
      await carregarDados();
    } catch (error) {
      console.error('Erro ao salvar usuário:', error);
      const mensagem = error.response?.data?.erro || error.response?.data?.email?.[0] || 'Erro ao salvar usuário';
      mostrarToast(mensagem, 'error');
      if (error.response?.data) {
        setErros(error.response.data);
      }
    } finally {
      setSalvando(false);
    }
  };

  // Excluir usuário
  const confirmarExclusao = (usuario) => {
    setUsuarioSelecionado(usuario);
    setAcaoConfirmacao(() => async () => {
      try {
        await excluirUsuarioAdmin(usuario.id);
        mostrarToast('Usuário excluído com sucesso!', 'success');
        await carregarDados();
      } catch (error) {
        console.error('Erro ao excluir usuário:', error);
        mostrarToast(error.response?.data?.erro || 'Erro ao excluir usuário', 'error');
      }
    });
    setConfirmacaoAberta(true);
  };

  // Salvar componentes
  const salvarComponentes = async () => {
    try {
      setSalvando(true);
      const componentesAtuais = usuarioSelecionado.componentes?.map(c => c.id) || [];
      const componentesNovos = formData.componentes_ids;
      
      // Componentes a adicionar
      const adicionar = componentesNovos.filter(id => !componentesAtuais.includes(id));
      if (adicionar.length > 0) {
        await gerenciarComponentesUsuario(usuarioSelecionado.id, 'adicionar', adicionar);
      }
      
      // Componentes a remover
      const remover = componentesAtuais.filter(id => !componentesNovos.includes(id));
      if (remover.length > 0) {
        await gerenciarComponentesUsuario(usuarioSelecionado.id, 'remover', remover);
      }
      
      mostrarToast('Componentes atualizados com sucesso!', 'success');
      setModalAberto(null);
      await carregarDados();
    } catch (error) {
      console.error('Erro ao salvar componentes:', error);
      mostrarToast(error.response?.data?.erro || 'Erro ao atualizar componentes', 'error');
    } finally {
      setSalvando(false);
    }
  };

  // Adicionar meses de acesso
  const salvarMeses = async () => {
    setErros({});
    const novosErros = {};

    if (!mesesAcesso) {
      novosErros.mesesAcesso = 'Quantidade de meses é obrigatória';
    } else {
      const meses = parseInt(mesesAcesso);
      if (isNaN(meses) || meses <= 0) {
        novosErros.mesesAcesso = 'Quantidade de meses deve ser um número maior que zero';
      }
    }

    if (Object.keys(novosErros).length > 0) {
      setErros(novosErros);
      return;
    }

    try {
      setSalvando(true);
      const resultado = await adicionarMesesAcesso(usuarioSelecionado.id, parseInt(mesesAcesso));
      mostrarToast(resultado.mensagem || 'Meses de acesso adicionados com sucesso!', 'success');
      setModalAberto(null);
      setMesesAcesso('');
      await carregarDados();
    } catch (error) {
      console.error('Erro ao adicionar meses:', error);
      mostrarToast(error.response?.data?.erro || 'Erro ao adicionar meses de acesso', 'error');
      if (error.response?.data) {
        setErros(error.response.data);
      }
    } finally {
      setSalvando(false);
    }
  };

  // Redefinir senha
  const salvarSenha = async () => {
    setErros({});
    const novosErros = {};

    if (!novaSenha) novosErros.novaSenha = 'Senha é obrigatória';
    else if (novaSenha.length < 6) novosErros.novaSenha = 'Senha deve ter no mínimo 6 caracteres';
    
    if (novaSenha !== confirmarSenha) novosErros.confirmarSenha = 'Senhas não coincidem';

    if (Object.keys(novosErros).length > 0) {
      setErros(novosErros);
      return;
    }

    try {
      setSalvando(true);
      await redefinirSenhaUsuario(usuarioSelecionado.id, novaSenha);
      mostrarToast('Senha redefinida com sucesso!', 'success');
      setModalAberto(null);
      setNovaSenha('');
      setConfirmarSenha('');
    } catch (error) {
      console.error('Erro ao redefinir senha:', error);
      mostrarToast(error.response?.data?.erro || 'Erro ao redefinir senha', 'error');
      if (error.response?.data) {
        setErros(error.response.data);
      }
    } finally {
      setSalvando(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-page-wrapper">
        <div className="loading-container">
          <Loader2 className="loading-spinner" />
          <p>Carregando usuários...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page-wrapper">
      <div className="admin-container">
        {/* Cabeçalho */}
        <div className="admin-header">
          <div className="admin-header-left">
            <Shield className="admin-icon" />
            <div>
              <h1>Administração de Usuários</h1>
              <p>Gerencie usuários, perfis e acessos ao sistema</p>
            </div>
          </div>
          <button className="btn-primary" onClick={abrirModalCriar}>
            <Plus size={20} />
            Novo Usuário
          </button>
        </div>

        {/* Filtros e Busca */}
        <div className="admin-filters">
          <div className="search-box">
            <Search size={20} />
            <input
              type="text"
              placeholder="Buscar por nome, email ou usuário..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <div className="filter-buttons">
            <button
              className={filtroAtivo === 'todos' ? 'active' : ''}
              onClick={() => setFiltroAtivo('todos')}
            >
              Todos ({usuarios.length})
            </button>
            <button
              className={filtroAtivo === 'ativos' ? 'active' : ''}
              onClick={() => setFiltroAtivo('ativos')}
            >
              Ativos ({usuarios.filter(u => u.is_active).length})
            </button>
            <button
              className={filtroAtivo === 'inativos' ? 'active' : ''}
              onClick={() => setFiltroAtivo('inativos')}
            >
              Inativos ({usuarios.filter(u => !u.is_active).length})
            </button>
          </div>
        </div>

        {/* Lista de Usuários */}
        <div className="usuarios-grid">
          {usuariosFiltrados.length === 0 ? (
            <div className="empty-state">
              <Users size={48} />
              <p>Nenhum usuário encontrado</p>
            </div>
          ) : (
            usuariosFiltrados.map(usuario => (
              <div key={usuario.id} className={`usuario-card ${!usuario.is_active ? 'inactive' : ''}`}>
                <div className="usuario-card-header">
                  <div className="usuario-info">
                    <h3>{usuario.nome || 'Sem nome'}</h3>
                    <p className="usuario-email">{usuario.email}</p>
                    {usuario.usuario && <p className="usuario-username">@{usuario.usuario}</p>}
                  </div>
                  <div className={`status-badge ${usuario.is_active ? 'active' : 'inactive'}`}>
                    {usuario.is_active ? 'Ativo' : 'Inativo'}
                  </div>
                </div>

                <div className="usuario-card-body">
                  {usuario.perfil_nome && (
                    <div className="info-row">
                      <span className="label">Perfil:</span>
                      <span className="value">{usuario.perfil_nome}</span>
                    </div>
                  )}
                  
                  {usuario.componentes && usuario.componentes.length > 0 && (
                    <div className="info-row">
                      <span className="label">Componentes:</span>
                      <div className="componentes-tags">
                        {usuario.componentes.slice(0, 3).map(comp => (
                          <span key={comp.id} className="tag">{comp.nome}</span>
                        ))}
                        {usuario.componentes.length > 3 && (
                          <span className="tag-more">+{usuario.componentes.length - 3}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {usuario.funcionalidades && usuario.funcionalidades.length > 0 && (
                    <div className="info-row">
                      <span className="label">Funcionalidades:</span>
                      <div className="funcionalidades-tags">
                        {usuario.funcionalidades.slice(0, 2).map(func => (
                          <span key={func.id} className="tag-small">{func.nome}</span>
                        ))}
                        {usuario.funcionalidades.length > 2 && (
                          <span className="tag-more">+{usuario.funcionalidades.length - 2}</span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="info-row">
                    <span className="label">Criado em:</span>
                    <span className="value">
                      {new Date(usuario.criado_em).toLocaleDateString('pt-BR')}
                    </span>
                  </div>

                  {usuario.expira_em && (
                    <div className="info-row">
                      <span className="label">Expira em:</span>
                      <span className={`value ${new Date(usuario.expira_em) < new Date() ? 'expirado' : ''}`}>
                        {new Date(usuario.expira_em).toLocaleDateString('pt-BR')}
                        {new Date(usuario.expira_em) < new Date() && (
                          <span className="badge-expirado"> (Expirado)</span>
                        )}
                      </span>
                    </div>
                  )}
                  {!usuario.expira_em && (
                    <div className="info-row">
                      <span className="label">Expira em:</span>
                      <span className="value">Sem data de expiração</span>
                    </div>
                  )}
                </div>

                <div className="usuario-card-actions">
                  <button
                    className="btn-icon"
                    onClick={() => abrirModalEditar(usuario)}
                    title="Editar usuário"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    className="btn-icon"
                    onClick={() => abrirModalComponentes(usuario)}
                    title="Gerenciar componentes"
                  >
                    <Shield size={18} />
                  </button>
                  <button
                    className="btn-icon"
                    onClick={() => abrirModalMeses(usuario)}
                    title="Adicionar meses de acesso"
                  >
                    <Calendar size={18} />
                  </button>
                  <button
                    className="btn-icon"
                    onClick={() => abrirModalSenha(usuario)}
                    title="Redefinir senha"
                  >
                    <Key size={18} />
                  </button>
                  <button
                    className="btn-icon btn-danger"
                    onClick={() => confirmarExclusao(usuario)}
                    title="Excluir usuário"
                    disabled={usuario.id === user?.id}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal de Criar/Editar Usuário */}
      {modalAberto === 'criar' || modalAberto === 'editar' ? (
        <div className="modal-overlay" onClick={() => setModalAberto(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modalAberto === 'criar' ? 'Novo Usuário' : 'Editar Usuário'}</h2>
              <button className="btn-close" onClick={() => setModalAberto(null)}>
                <X size={24} />
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Nome *</label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  className={erros.nome ? 'error' : ''}
                />
                {erros.nome && <span className="error-message">{erros.nome}</span>}
              </div>

              <div className="form-group">
                <label>Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={erros.email ? 'error' : ''}
                />
                {erros.email && <span className="error-message">{erros.email}</span>}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Usuário</label>
                  <input
                    type="text"
                    value={formData.usuario}
                    onChange={(e) => setFormData({ ...formData, usuario: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Telefone</label>
                  <input
                    type="text"
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Tipo de Documento</label>
                  <select
                    value={formData.tipo_documento}
                    onChange={(e) => setFormData({ ...formData, tipo_documento: e.target.value })}
                  >
                    <option value="CPF">CPF</option>
                    <option value="CNPJ">CNPJ</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Documento</label>
                  <input
                    type="text"
                    value={formData.documento}
                    onChange={(e) => setFormData({ ...formData, documento: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Perfil</label>
                <select
                  value={formData.perfil_id || ''}
                  onChange={(e) => setFormData({ ...formData, perfil_id: e.target.value ? parseInt(e.target.value) : null })}
                >
                  <option value="">Sem perfil</option>
                  {perfisDisponiveis.map(perfil => (
                    <option key={perfil.id} value={perfil.id}>{perfil.nome}</option>
                  ))}
                </select>
              </div>

              {modalAberto === 'criar' && (
                <div className="form-group">
                  <label>Senha *</label>
                  <input
                    type="password"
                    value={formData.senha}
                    onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                    className={erros.senha ? 'error' : ''}
                  />
                  {erros.senha && <span className="error-message">{erros.senha}</span>}
                </div>
              )}

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  />
                  <span>Usuário ativo</span>
                </label>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalAberto(null)}>
                Cancelar
              </button>
              <button className="btn-primary" onClick={salvarUsuario} disabled={salvando}>
                {salvando ? <Loader2 className="spinner" /> : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal de Componentes */}
      {modalAberto === 'componentes' && usuarioSelecionado ? (
        <div className="modal-overlay" onClick={() => setModalAberto(null)}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Gerenciar Componentes - {usuarioSelecionado.nome}</h2>
              <button className="btn-close" onClick={() => setModalAberto(null)}>
                <X size={24} />
              </button>
            </div>

            <div className="modal-body">
              <div className="componentes-grid">
                {componentesDisponiveis.map(componente => {
                  const selecionado = formData.componentes_ids.includes(componente.id);
                  return (
                    <label key={componente.id} className={`componente-checkbox ${selecionado ? 'selected' : ''}`}>
                      <input
                        type="checkbox"
                        checked={selecionado}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              componentes_ids: [...formData.componentes_ids, componente.id]
                            });
                          } else {
                            setFormData({
                              ...formData,
                              componentes_ids: formData.componentes_ids.filter(id => id !== componente.id)
                            });
                          }
                        }}
                      />
                      <span>{componente.nome}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalAberto(null)}>
                Cancelar
              </button>
              <button className="btn-primary" onClick={salvarComponentes} disabled={salvando}>
                {salvando ? <Loader2 className="spinner" /> : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal de Adicionar Meses de Acesso */}
      {modalAberto === 'meses' && usuarioSelecionado ? (
        <div className="modal-overlay" onClick={() => setModalAberto(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Adicionar Meses de Acesso - {usuarioSelecionado.nome}</h2>
              <button className="btn-close" onClick={() => setModalAberto(null)}>
                <X size={24} />
              </button>
            </div>

            <div className="modal-body">
              {usuarioSelecionado.expira_em && (
                <div className="info-box">
                  <p><strong>Data de expiração atual:</strong> {new Date(usuarioSelecionado.expira_em).toLocaleDateString('pt-BR', { 
                    day: '2-digit', 
                    month: '2-digit', 
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}</p>
                  {new Date(usuarioSelecionado.expira_em) < new Date() && (
                    <p className="warning-text">⚠️ O acesso deste usuário está expirado</p>
                  )}
                </div>
              )}
              {!usuarioSelecionado.expira_em && (
                <div className="info-box">
                  <p><strong>Status:</strong> Usuário sem data de expiração definida</p>
                  <p className="info-text">Ao adicionar meses, será definida uma data de expiração a partir de hoje.</p>
                </div>
              )}

              <div className="form-group">
                <label>Quantidade de Meses *</label>
                <input
                  type="number"
                  min="1"
                  value={mesesAcesso}
                  onChange={(e) => setMesesAcesso(e.target.value)}
                  placeholder="Ex: 1, 3, 6, 12"
                  className={erros.mesesAcesso ? 'error' : ''}
                />
                {erros.mesesAcesso && <span className="error-message">{erros.mesesAcesso}</span>}
                <small className="form-hint">
                  {mesesAcesso && !isNaN(parseInt(mesesAcesso)) && parseInt(mesesAcesso) > 0 && (
                    <span>
                      Nova data de expiração: {
                        usuarioSelecionado.expira_em && new Date(usuarioSelecionado.expira_em) > new Date()
                          ? new Date(new Date(usuarioSelecionado.expira_em).setMonth(new Date(usuarioSelecionado.expira_em).getMonth() + parseInt(mesesAcesso))).toLocaleDateString('pt-BR')
                          : new Date(new Date().setMonth(new Date().getMonth() + parseInt(mesesAcesso))).toLocaleDateString('pt-BR')
                      }
                    </span>
                  )}
                </small>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalAberto(null)}>
                Cancelar
              </button>
              <button className="btn-primary" onClick={salvarMeses} disabled={salvando}>
                {salvando ? <Loader2 className="spinner" /> : 'Adicionar Meses'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal de Redefinir Senha */}
      {modalAberto === 'senha' && usuarioSelecionado ? (
        <div className="modal-overlay" onClick={() => setModalAberto(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Redefinir Senha - {usuarioSelecionado.nome}</h2>
              <button className="btn-close" onClick={() => setModalAberto(null)}>
                <X size={24} />
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Nova Senha *</label>
                <input
                  type="password"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  className={erros.novaSenha ? 'error' : ''}
                />
                {erros.novaSenha && <span className="error-message">{erros.novaSenha}</span>}
              </div>

              <div className="form-group">
                <label>Confirmar Senha *</label>
                <input
                  type="password"
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  className={erros.confirmarSenha ? 'error' : ''}
                />
                {erros.confirmarSenha && <span className="error-message">{erros.confirmarSenha}</span>}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalAberto(null)}>
                Cancelar
              </button>
              <button className="btn-primary" onClick={salvarSenha} disabled={salvando}>
                {salvando ? <Loader2 className="spinner" /> : 'Redefinir'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal de Confirmação */}
      <ConfirmModal
        isOpen={confirmacaoAberta}
        onClose={() => {
          setConfirmacaoAberta(false);
          setAcaoConfirmacao(null);
        }}
        onConfirm={() => {
          if (acaoConfirmacao) {
            acaoConfirmacao();
          }
          setConfirmacaoAberta(false);
          setAcaoConfirmacao(null);
        }}
        title="Confirmar Exclusão"
        message={`Tem certeza que deseja excluir o usuário "${usuarioSelecionado?.nome}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        cancelText="Cancelar"
        type="danger"
      />
    </div>
  );
}

