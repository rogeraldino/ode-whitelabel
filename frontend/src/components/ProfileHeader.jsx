import React, { useState, useRef, useEffect } from 'react'
import { LogOut, User, Menu } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import '../style/profileHeader.css'

export default function ProfileHeader({ nomeCompleto, onToggleSidebar, isMobile, isTablet, disableMenuButton }) {
  const { user, loading, logout } = useAuth()
  const [isProfileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef(null)
  const navigate = useNavigate()
  const location = useLocation()

  const displayName =
      user?.usuario ??
      user?.nome ??
      nomeCompleto ??
      'Usuário'

  const avatarInitials = displayName
      .split(' ')
      .map(p => p[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fechar dropdown ao mudar de rota
  useEffect(() => { setProfileOpen(false) }, [location.pathname])

  // Fechar com ESC
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') setProfileOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleLogout = async () => {
    try {
      await logout()
      setProfileOpen(false)
    } catch (error) {
      console.error('Erro ao fazer logout:', error)
    }
  }

  const getCurrentTime = () => {
    const now = new Date()
    const hours = now.getHours()
    if (hours < 12) return 'Bom dia'
    if (hours < 18) return 'Boa tarde'
    return 'Boa noite'
  }

  if (loading) {
    return (
        <header className="profile-header loading">
          <div className="profile-header__card">
            <div className="profile-header__container profile-header__container--full">
              <div className="profile-header__left">
                {/* Menu só no desktop */}
                {(!isMobile && !isTablet) && !disableMenuButton && (
                    <button
                        className="profile-header__menu-btn"
                        aria-label="Abrir/fechar menu lateral"
                        onClick={onToggleSidebar}
                        type="button"
                    >
                      <Menu size={28} aria-hidden="true" />
                    </button>
                )}

                <img
                    src="/assets/mark.svg"
                    alt="Marca da aplicação"
                    className="profile-header__logo-img profile-header__logo-img--clickable"
                    onClick={() => navigate('/')}
                />
              </div>

              <div className="profile-header__greeting">
                <span className="profile-header__greeting-text">Carregando...</span>
              </div>

              <div className="profile-header__profile">
                <div className="profile-header__avatar-btn profile-header__avatar-btn--loading" aria-hidden="true" />
              </div>
            </div>
          </div>
        </header>
    )
  }

  return (
      <header className="profile-header">
        <div className="profile-header__card">
          <div className="profile-header__container profile-header__container--full">
            {/* Logo */}
            <div className="profile-header__left">
              {/* Menu só no desktop (mantido para consistência futura) */}
              {(!isMobile && !isTablet) && !disableMenuButton && (
                  <button
                      className="profile-header__menu-btn"
                      aria-label="Abrir/fechar menu lateral"
                      onClick={onToggleSidebar}
                      type="button"
                  >
                    <Menu size={24} aria-hidden="true" />
                  </button>
              )}

              <img
                  src="/assets/mark.svg"
                  alt="Marca da aplicação"
                  className="profile-header__logo-img profile-header__logo-img--clickable"
                  onClick={() => navigate('/')}
                  title="Ir para Home"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate('/')}
                  aria-label="Ir para a página inicial"
              />
            </div>

            {/* Saudação */}
            <div className="profile-header__greeting">
            <span className="profile-header__greeting-text">
              {getCurrentTime()}, <strong>{displayName}</strong>!
            </span>
            </div>

            {/* Avatar + Menu de Perfil */}
            <div className="profile-header__profile" ref={profileRef}>
              <button
                  onClick={() => setProfileOpen(v => !v)}
                  className="profile-header__avatar-btn"
                  aria-label="Abrir menu de perfil"
                  aria-expanded={isProfileOpen}
                  aria-haspopup="menu"
                  type="button"
              >
                {avatarInitials}
              </button>

              {isProfileOpen && (
                  <ul className="profile-header__menu" role="menu" aria-label="Menu do perfil">
                    <li role="none">
                      <div className="profile-header__menu-header">
                        <div className="profile-header__menu-avatar">{avatarInitials}</div>
                        <div className="profile-header__menu-user-info">
                          <div className="profile-header__menu-user-name">{displayName}</div>
                          <div className="profile-header__menu-user-email">{user?.email || 'usuario@exemplo.com'}</div>
                        </div>
                      </div>
                    </li>

                    <li role="none">
                      <button
                          onClick={() => { navigate('/perfil'); setProfileOpen(false) }}
                          className="profile-header__menu-item"
                          role="menuitem"
                          type="button"
                      >
                        <User size={16} className="profile-header__menu-icon" aria-hidden="true" />
                        Minha Conta
                      </button>
                    </li>

                    <li role="separator" className="profile-header__menu-divider" />

                    <li role="none">
                      <button
                          onClick={handleLogout}
                          className="profile-header__menu-item profile-header__menu-item--danger"
                          role="menuitem"
                          type="button"
                      >
                        <LogOut size={16} className="profile-header__menu-icon" aria-hidden="true" />
                        Sair
                      </button>
                    </li>
                  </ul>
              )}
            </div>
          </div>
        </div>
      </header>
  )
}
