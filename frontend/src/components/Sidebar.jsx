// src/components/Sidebar.jsx
import React, { useCallback, memo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import clsx from 'clsx'
import { Home, BookOpen, Sparkles, Network, CheckCircle, FileText, Lock, Shield } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.jsx'
import '../style/sidebar.css'

const menuItems = [
    { name: 'Home', path: '/', icon: Home },
    { name: 'Gerar Atividades', path: '/gerar-atividades', icon: Sparkles, slug: 'gerar-atividade' },
    { name: 'Plano de Aula', path: '/plano-de-aula-gerador', icon: BookOpen, slug: 'gerar-plano-de-aula' },
    { name: 'Resumo', path: '/resumo', icon: FileText, slug: 'gerar-resumo' },
    { name: 'Mapa Mental', path: '/mapa-mental', icon: Network, slug: 'baixar-mapa-mental' },
    { name: 'Corrigir Atividades', path: '/corrigir-atividade', icon: CheckCircle, slug: 'corrigir-atividade' },
    { name: 'Administração', path: '/admin/usuarios', icon: Shield, slug: 'administrador' },
]

const Sidebar = memo(function Sidebar(props) {
    const location = useLocation()
    const pathname = location?.pathname ?? window.location.pathname
    const { collapsed, open, onClose, onToggleSidebar } = props
    const { user } = useAuth()

    // mobile usa drawer
    const isDrawer = typeof open !== 'undefined'

    const handleToggleClick = useCallback(() => {
        if (onToggleSidebar) onToggleSidebar()
    }, [onToggleSidebar])

    if (isDrawer) {
        // Drawer (mobile)
        return (
            <>
                {/* overlay */}
                <div
                    className={clsx('sidebar__overlay', { 'is-visible': open })}
                    onClick={onClose}
                />
                <nav
                    className={clsx('sidebar', 'sidebar--drawer', { 'sidebar--open': open })}
                    aria-hidden={!open}
                >
                    <button
                        onClick={onClose}
                        className="sidebar__close-btn"
                        aria-label="Fechar menu"
                        type="button"
                    >
                        ×
                    </button>

                    <ul className="sidebar__menu">
                        {menuItems.map(({ name, path, icon: IconComp, slug }) => {
                            const isActive = pathname === path
                            const permitido = !slug || user?.funcionalidades?.includes(slug)
                            return (
                                <li key={path}>
                                    {permitido ? (
                                        <Link
                                            to={path}
                                            className={clsx('sidebar__item', { 'sidebar__item--active': isActive })}
                                            onClick={onClose}
                                        >
                                            <IconComp size={20} className="sidebar__item-icon" />
                                            <span className="sidebar__item-label">{name}</span>
                                        </Link>
                                    ) : (
                                        <div className="sidebar__item sidebar__item--disabled">
                                            <IconComp size={20} className="sidebar__item-icon" />
                                            <span className="sidebar__item-label">{name}</span>
                                            <Lock size={16} className="sidebar__lock-icon" />
                                        </div>
                                    )}
                                </li>
                            )
                        })}
                    </ul>
                </nav>
            </>
        )
    }

    // Desktop/Tablet (sidebar fixo)
    return (
        <nav className={clsx('sidebar', { 'sidebar--collapsed': collapsed })}>
            <ul className="sidebar__menu">
                {menuItems.map(({ name, path, icon: IconComp, slug }) => {
                    const isActive = pathname === path
                    const permitido = !slug || user?.funcionalidades?.includes(slug)
                    return (
                        <li key={path}>
                            {permitido ? (
                                <Link
                                    to={path}
                                    className={clsx('sidebar__item', { 'sidebar__item--active': isActive })}
                                >
                                    <IconComp size={20} className="sidebar__item-icon" />
                                    {!collapsed && <span className="sidebar__item-label">{name}</span>}
                                </Link>
                            ) : (
                                <div className="sidebar__item sidebar__item--disabled">
                                    <IconComp size={20} className="sidebar__item-icon" />
                                    {!collapsed && <span className="sidebar__item-label">{name}</span>}
                                    <Lock size={16} className="sidebar__lock-icon" />
                                </div>
                            )}
                        </li>
                    )
                })}
            </ul>

            {/* Toggle footer */}
            <div className="sidebar__toggle-container">
                <button
                    className="sidebar__toggle-btn"
                    onClick={handleToggleClick}
                    aria-label={collapsed ? 'Expandir menu' : 'Fechar menu'}
                    type="button"
                >
                    {!collapsed && <span className="toggle-text">Fechar menu</span>}
                    <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        className={clsx('toggle-icon', { collapsed })}
                        aria-hidden="true"
                    >
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </button>
            </div>
        </nav>
    )
})

export default Sidebar
