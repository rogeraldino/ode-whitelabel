import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import ProfileHeader from './ProfileHeader'
import { Outlet, useLocation } from 'react-router-dom'
import '../style/layout.css'

export default function Layout() {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
    const [isMobile, setIsMobile] = useState(false)
    const [isTablet, setIsTablet] = useState(false)
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
    const location = useLocation()

    // Detectar se é mobile ou tablet (usando os breakpoints antigos que você já tem)
    useEffect(() => {
        const checkDeviceType = () => {
            const width = window.innerWidth
            setIsMobile(width <= 767)
            setIsTablet(width >= 768 && width <= 1023)
        }
        checkDeviceType()
        window.addEventListener('resize', checkDeviceType)
        return () => window.removeEventListener('resize', checkDeviceType)
    }, [])

    // Verificar se estamos na tela de edição
    const isEditorScreen = useMemo(() => {
        return (
            location.pathname.includes('/editor-lista') ||
            location.pathname.includes('/editar-lista')
        )
    }, [location.pathname])

    // Toggle do sidebar (apenas desktop)
    const handleToggleSidebar = useCallback(() => {
        if (!isMobile && !isTablet) {
            setSidebarCollapsed(prev => !prev)
        }
    }, [isMobile, isTablet])

    return (
        <div className="layout">
            {/* Sidebar – APENAS DESKTOP */}
            {!isMobile && !isTablet && (
                <Sidebar
                    collapsed={sidebarCollapsed}
                    onToggleSidebar={handleToggleSidebar}
                />
            )}

            {/* Header fixo no topo */}
            <ProfileHeader
                onToggleSidebar={handleToggleSidebar}
                isMobile={isMobile}
                isTablet={isTablet}
                disableMenuButton={isEditorScreen}
            />

            {/* Conteúdo principal */}
            <main
                className={`layout__content${
                    !isMobile && !isTablet && sidebarCollapsed ? ' layout__content--collapsed' : ''
                }${isMobile ? ' layout__content--mobile' : ''}${
                    isTablet ? ' layout__content--tablet' : ''
                }`}
                style={{ overflowX: 'hidden' }}   // ou: { overflowX: 'hidden', overflowY: 'visible' }
            >
                <Outlet />

                {/* Rodapé oficial do sistema, apenas na web (mantido como estava) */}
                <div
                    style={{
                        width: '100%',
                        marginTop: 'auto',
                        padding: '0',
                        display: 'none',
                        justifyContent: 'center',
                        alignItems: 'center',
                        fontFamily: 'Quicksand, sans-serif',
                        fontSize: 13,
                        color: '#6B7280',
                        background: '#F3F4F6',
                        letterSpacing: 0.2,
                        zIndex: 100,
                        position: 'relative',
                        boxShadow: '0 -2px 10px rgba(0,0,0,0.05)',
                        minHeight: '48px',
                        height: '48px',
                        borderTop: '1px solid #E5E7EB',
                    }}
                    className="footer-web-only"
                >
                    {/* ...conteúdo do footer mantido... */}
                </div>
            </main>

            {/* Sidebar drawer (Mobile/Tablet) controlado pelo BottomNav */}
            {(isMobile || isTablet) && (
                <Sidebar open={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)} />
            )}

            {/* Bottom navigation (mobile/tablet via CSS) */}
            <BottomNav onOpenSidebar={() => setMobileSidebarOpen(true)} />
            <style>{`
        @media (min-width: 700px) {
          .footer-web-only { display: block !important; }
        }
      `}</style>
        </div>
    )
}
