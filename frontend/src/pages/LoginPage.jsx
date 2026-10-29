// src/pages/LoginPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, User, Eye, EyeOff, Shield, Zap, CheckCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.jsx';
import '../style/LoginPage.css';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return isMobile;
}

export default function LoginPage() {
  const isMobile = useIsMobile();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login, user } = useAuth();

  useEffect(() => {
    if (user?.isAuthenticated) {
      navigate('/');
    }
  }, [user]);

  // Limpa o campo de senha sempre que o usuário desloga
  useEffect(() => {
    if (!user?.isAuthenticated) {
      setFormData(prev => ({ ...prev, password: '' }));
    }
  }, [user]);

  const handleChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    try {
      await login(formData);
      navigate('/');
    } catch (err) {
      setError(
          err.response?.data
              ? JSON.stringify(err.response.data)
              : 'Erro ao fazer login. Verifique sua conexão e tente novamente.'
      );
    }
  };

  // ===== MOBILE =====
  if (isMobile) {
    return (
        <div className="login-page">
          <header className="login-header">
            <div className="mobile-logo generic-mark" aria-label="Plataforma educacional" onClick={() => navigate('/')}>E</div>
            <h1 className="login-title">
              Crie, Gerencie<br />
              e Potencialize<br />
              seu Ensino
            </h1>
            <p className="login-subtitle">
              {/* Transforme sua experiência educacional com nossa plataforma inovadora de gestão de conteúdo pedagógico. */}
            </p>
          </header>

          <div className="login-body">
            <div className="login-card">
              <form onSubmit={handleSubmit} className="login-form">
                {error && <div className="login-error">{error}</div>}

                <div className="input-group">
                  <User size={20} />
                  <input
                      type="email"
                      name="email"
                      placeholder="Digite seu e-mail cadastrado"
                      value={formData.email}
                      onChange={handleChange}
                      required
                  />
                </div>

                <div className="input-group">
                  <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      placeholder="Digite sua senha"
                      value={formData.password}
                      onChange={handleChange}
                      required
                  />
                  <button
                      type="button"
                      className="toggle-password"
                      onClick={() => setShowPassword(v => !v)}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>


                <button type="submit" className="btn-login">
                  Entrar
                </button>

                <p className="signup-prompt">
                  Não tem uma conta?{' '}
                  <span className="signup-link" onClick={() => navigate('/signup')}>
                  Cadastre aqui
                </span>
                </p>
              </form>
            </div>
          </div>

        </div>
    );
  }

  // ===== DESKTOP =====
  return (
      <div className="login-container">
        <div className="login-left">
          <div className="floating-shape shape-1">
            <Zap size={24} />
          </div>
          <div className="floating-shape shape-2"></div>

          <div className="login-left-top">
            <div className="logo-area" style={{cursor: 'pointer'}} onClick={() => navigate('/')}>
              <span className="generic-mark" aria-hidden="true">E</span>
              <div className="logo-text">
                  <span className="logo-subtext">Plataforma educacional</span>
              </div>
            </div>
            <div>
              <h2 className="desktop-title">
                Crie, Gerencie<br />
                e Potencialize<br />
                seu Ensino
              </h2>
              <p>
                {/* Transforme sua experiência educacional com nossa plataforma inovadora de gestão de conteúdo pedagógico. */}
              </p>
            </div>
          </div>

          <div className="login-left-bottom">
            <div className="feature-item">
                <div className="feature-icon"><CheckCircle size={18} /></div>
                <div className="feature-text">
                    <strong>100%</strong>
                    <span>alinhado a BNCC</span>
                </div>
            </div>
            <div className="feature-item">
                <div className="feature-icon"><CheckCircle size={18} /></div>
                <div className="feature-text">
                    <strong>Economia de Tempo</strong>
                    <span>Até 10x mais rápido</span>
                </div>
            </div>
            <div className="feature-item">
                <div className="feature-icon"><CheckCircle size={18} /></div>
                <div className="feature-text">
                    <strong>Qualidade Superior</strong>
                    <span>Revisão pedagógica</span>
                </div>
            </div>
            <div className="feature-item">
                <div className="feature-icon"><CheckCircle size={18} /></div>
                <div className="feature-text">
                    <strong>Personalização</strong>
                    <span> De acordo com a sua necessidade</span>
                </div>
            </div>
          </div>
        </div>
        <div className="login-right">
          <div className="login-box">
            <h3>Entrar na Plataforma</h3>
            <p>Materiais de aula para Professores</p>
            <form onSubmit={handleSubmit}>
              {error && <p className="error-message">{error}</p>}
              <label>
                Usuário
                <div className="input-group">
                  <span className="icon"><User size={18} /></span>
                  <input
                      type="email"
                      name="email"
                      placeholder="Digite seu e-mail cadastrado"
                      value={formData.email}
                      onChange={handleChange}
                      required
                  />
                </div>
              </label>
              <label>
                Senha
                <div className="input-group">
                  <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      placeholder="Digite sua senha"
                      value={formData.password}
                      onChange={handleChange}
                      required
                  />
                  <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="toggle-password"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>
              <button type="submit" className="btn-primary">ENTRAR</button>
            </form>
          </div>
        </div>
      </div>
  );
}
