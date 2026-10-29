// src/pages/HomePage.jsx
import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
    ClipboardList,
    BookOpen,
    Network,
    FileText,
    QrCode,
    GraduationCap,
    Clock,
    Lock,
    Sparkles,
    Presentation,
} from 'lucide-react'
import '../style/homePage.css'
import { buscarListasApi } from '../services/Api.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import PrimeiroAcessoModal from '../components/modals/PrimeiroAcessoModal.jsx'
import SkeletonLoading from '../components/SkeletonLoading.jsx'
import EmptyState from '../components/EmptyState.jsx'

// Helper para mapear dados da API para o formato da UI
const mapApiDataToActivity = (listas) => {
    const typeIcons = {
        atividade:     { icon: <Sparkles />, color: 'blue-light' },
        plano:         { icon: <BookOpen />, color: 'purple-light' },
        mapa_mental:   { icon: <Network />,  color: 'green-light' },
        resumo:        { icon: <FileText />, color: 'orange-light' },
        slide:         { icon: <Presentation />, color: 'red-light' },
        corrigir_atividade: { icon: <QrCode />, color: 'cyan-light' },
    }
    const fallback = { icon: <ClipboardList />, color: 'blue-light' }

    return listas.map((lista) => {
        const iconData = typeIcons[lista.tipo] || fallback
        const bnccCode =
            Array.isArray(lista.codigos_bncc) && lista.codigos_bncc.length > 0
                ? lista.codigos_bncc[0]
                : ''

        return {
            uuid: lista.uuid,
            ...iconData,
            title: lista.nome,
            componente:
                lista.disciplina || lista.componente || lista.componente_curricular || 'Matemática',
            bncc: bnccCode,
            time: 'Recente',
        }
    })
}

export default function HomePage() {
    const [activities, setActivities] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState(null)
    const { user, loading: authLoading } = useAuth()
    const deveMostrarPrimeiroAcesso = user?.isAuthenticated && user.usuario === null
    const [openMenuUuid, setOpenMenuUuid] = useState(null)
    const menuRef = useRef(null)
    const disciplinas = ['Matemática']
    const [disciplinaIndex, setDisciplinaIndex] = useState(0)

    useEffect(() => {
        const fetchActivities = async () => {
            setIsLoading(true)
            setError(null)
            try {
                const data = await buscarListasApi('', false)
                const mappedData = mapApiDataToActivity(data.slice(0, 3))
                setActivities(mappedData)
            } catch (err) {
                console.error('Erro ao buscar listas do usuário:', err)
                setError('Não foi possível carregar suas atividades recentes. Tente novamente.')
                setActivities([])
            } finally {
                setIsLoading(false)
            }
        }
        fetchActivities()
    }, [])

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setOpenMenuUuid(null)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [])

    useEffect(() => {
        const interval = setInterval(() => {
            setDisciplinaIndex((prevIndex) => (prevIndex + 1) % disciplinas.length)
        }, 3000)
        return () => clearInterval(interval)
    }, [])

    const handleRemoveActivity = (uuidToRemove) => {
        setActivities((prev) => prev.filter((activity) => activity.uuid !== uuidToRemove))
        setOpenMenuUuid(null)
    }

    return (
        <div className="home">
            {deveMostrarPrimeiroAcesso && <PrimeiroAcessoModal />}

            <div className="home__hero-section">
                {/* Banner principal */}
                <div className="home__banner">
                    <div className="home__banner-content">
                        <h2 className="home__banner-title">
                            Materiais de <br /> <span>{disciplinas[disciplinaIndex]}</span>
                            <br /> Alinhados à BNCC
                        </h2>
                        <p className="home__banner-subtitle">
                            Sua didática em foco, nossa tecnologia em ação.
                        </p>
                        <div className="home__banner-buttons">
                            <Link to="/gerar-atividades" className="btn-primary home__banner-button">
                                <Sparkles size={18} />
                                Gerar Lista
                            </Link>
                        </div>
                    </div>

                    {/* Features List */}
                    <div className="home__features-list">
                        <div className="feature-card">
                            <div className="feature-icon-wrapper">
                                <GraduationCap className="feature-icon" />
                            </div>
                            <div className="feature-text">
                                <h3 className="feature-title">Fundamental ao Médio</h3>
                                <p className="feature-description">
                                    Cobertura completa do Ensino Fundamental ao Ensino Médio.
                                </p>
                            </div>
                        </div>

                        <div className="feature-card">
                            <div className="feature-icon-wrapper">
                                <Network className="feature-icon" />
                            </div>
                            <div className="feature-text">
                                <h3 className="feature-title">Seu assistente</h3>
                                <p className="feature-description">Crie materiais personalizadas.</p>
                            </div>
                        </div>

                        <div className="feature-card">
                            <div className="feature-icon-wrapper">
                                <BookOpen className="feature-icon" />
                            </div>
                            <div className="feature-text">
                                <h3 className="feature-title">100% BNCC</h3>
                                <p className="feature-description">
                                    Alinhamento total com as competências e habilidades da BNCC
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Ferramentas */}
            <div className="home__tools-section">
                <h3 className="section-title">Acesse suas ferramentas</h3>
                <div className="card-grid home__tools">
                    <ToolItem
                        icon={<Sparkles color="#fff" />}
                        title="Gerar Atividades"
                        description="Crie listas de exercícios personalizadas."
                        to="/gerar-atividades"
                        color="blue"
                        slug="gerar-atividade"
                    />
                    <ToolItem
                        icon={<BookOpen color="#fff" />}
                        title="Plano de Aula"
                        description="Gere planos completos com objetivos, metodologia e avaliação."
                        to="/plano-de-aula-gerador"
                        color="purple"
                        slug="gerar-plano-de-aula"
                    />
                    <ToolItem
                        icon={<Network color="#fff" />}
                        title="Mapa Mental"
                        description="Transforme qualquer tema em um mapa mental visual e atrativo."
                        to="/mapa-mental"
                        color="green"
                        slug="baixar-mapa-mental"
                    />
                    <ToolItem
                        icon={<FileText color="#fff" />}
                        title="Resumo"
                        description="Gere resumos automáticos de qualquer tema."
                        to="/resumo"
                        color="orange"
                        slug="gerar-resumo"
                    />
                    {/* Slide (desativado)
          <ToolItem
            icon={<Presentation color="#fff" />}
            title="Slide"
            description="Crie apresentações de slides alinhadas ao tema."
            to="/slide"
            color="red"
          />
          */}
                    <ToolItem
                        icon={<QrCode color="#fff" />}
                        title="Corrigir Atividade"
                        description="Corrija atividades rapidamente via QR Code."
                        to="/corrigir-atividade"
                        color="cyan"
                        slug="corrigir-atividade"
                    />
                </div>
            </div>

            {/* Materiais Recentes */}
            <div className="home__activities recent-activity-card">
                <div className="recent-activity-header">
                    <div className="recent-activity-header-title">
                        <span className="trophy-icon"><Clock size={20} /></span>
                        <h3>Materiais Recentes</h3>
                    </div>
                    <Link to="/perfil" className="btn-view-all">Ver todos</Link>
                </div>

                <div className="activity-list activity-list--grid">
                    {isLoading ? (
                        <SkeletonLoading />
                    ) : error ? (
                        <EmptyState
                            title={error}
                            message="Tente recarregar a página ou voltar mais tarde."
                            buttonText="Recarregar"
                            isError={true}
                        />
                    ) : activities.length > 0 ? (
                        activities.map((item) => (
                            <div className="activity-item activity-item--card" key={item.uuid}>
                                <Link to={`/editar-lista/${item.uuid}`} className="activity-item-link">
                                    <div className={`activity-icon bg-${item.color}`}>
                                        {item.icon}
                                    </div>
                                    <div className="activity-details">
                                        <span className="activity-title">{item.title}</span>
                                        <div className="activity-meta">
                                            <span className="activity-tag">{item.componente}</span>
                                            {item.bncc && <span className="activity-bncc">{item.bncc}</span>}
                                        </div>
                                    </div>
                                </Link>
                            </div>
                        ))
                    ) : (
                        <EmptyState />
                    )}
                </div>
            </div>
        </div>
    )
}

function ToolItem({ icon, title, description, to, color, slug }) {
    const { user } = useAuth()
    const permitido = !slug || user?.funcionalidades?.includes(slug)

    if (permitido) {
        return (
            <Link to={to} className={`card card--tool card--${color}`}>
        <span className="card__icon--big">
          {icon}
        </span>
                <div className="card__text-content">
                    <h4 className="card__title card__title--bold">{title}</h4>
                    <p className="card__description">{description}</p>
                </div>
            </Link>
        )
    }

    return (
        <div className={`card card--tool card--${color} card--disabled`}>
      <span className="card__icon--big">
        {icon}
          <Lock size={20} className="card__lock-icon" />
      </span>
            <div className="card__text-content">
                <h4 className="card__title card__title--bold">{title}</h4>
                <p className="card__description">{description}</p>
            </div>
        </div>
    )
}
