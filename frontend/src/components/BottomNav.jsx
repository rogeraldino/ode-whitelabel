import React from 'react'
import { NavLink } from 'react-router-dom'
import { Home, QrCode, Sparkles, Menu, Lock } from 'lucide-react'
import '../style/bottomNav.css'
import { useAuth } from '../hooks/useAuth.jsx'

const navItems = [
    { name: 'Home', to: '/', icon: Home },
    { name: 'Gerar Atividades', to: '/gerar-atividades', icon: Sparkles, slug: 'gerar-atividade' },
    { name: 'Corrigir Atividade', to: '/corrigir-atividade', icon: QrCode, slug: 'corrigir-atividade' },
]

export default function BottomNav({ onOpenSidebar }) {
    const { user } = useAuth()

    return (
        <nav className="bottom-nav" aria-label="Navegação principal móvel">
            {navItems.map(({ name, to, icon: Icon, slug }) => {
                const permitido = !slug || user?.funcionalidades?.includes(slug)

                return permitido ? (
                    <NavLink
                        key={to}
                        to={to}
                        end={to === '/'}
                        className={({ isActive }) =>
                            `bottom-nav__link${isActive ? ' bottom-nav__link--active' : ''}`
                        }
                    >
                        <Icon className="bottom-nav__icon" aria-hidden="true" />
                        <span className="bottom-nav__label">{name}</span>
                    </NavLink>
                ) : (
                    <div
                        key={to}
                        className="bottom-nav__link bottom-nav__link--disabled"
                        aria-disabled="true"
                    >
                        <Icon className="bottom-nav__icon" aria-hidden="true" />
                        <Lock className="bottom-nav__lock-icon" aria-hidden="true" />
                        <span className="bottom-nav__label">{name}</span>
                    </div>
                )
            })}

            <button
                className="bottom-nav__link bottom-nav__link--more"
                type="button"
                aria-label="Mais ferramentas"
                onClick={onOpenSidebar}
            >
                <Menu className="bottom-nav__icon" aria-hidden="true" />
                <span className="bottom-nav__label">Mais</span>
            </button>
        </nav>
    )
}
