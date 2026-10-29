import React, { useState } from 'react';
import { Mic, Paperclip, Info, NotebookPen, FileText, BookOpen, Target, Lightbulb, Users, Clock } from 'lucide-react';
import Select from 'react-select';
import AutocompleteHabilidade from '../components/AutocompleteHabilidade';
import HabilidadeCard from '../components/HabilidadeCard';
import LoadingScreen from '../components/LoadingScreen';
import SuccessAnimation from '../components/SuccessAnimation';
import TutorialButton from '../components/TutorialButton';
import TutorialModal from '../components/TutorialModal';
import { buscarHabilidades, gerarResumo, listarComponentes, listarAnosEscolares } from '../services/Api.jsx';
import { useAuth } from '../hooks/useAuth.jsx';
import '../style/tour-button-mobile.css';
import '../style/resumo.css';
import '../style/form-unificado.css';

export default function Resumo() {
  const { user } = useAuth();
  if (user && !user.funcionalidades?.includes('gerar-resumo')) {
    return <div className="p-4 text-center text-gray-500">Funcionalidade não disponível para seu perfil.</div>;
  }
  
  // Estado para detectar se é mobile
  const [isMobile, setIsMobile] = useState(false);
  
  // Verificar se é mobile
  React.useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);
  const [formData, setFormData] = useState({
    titulo: '',
    assunto: '',
    componente: '',
    anoTurma: '',
    habilidade: [],
  });
  const [errors, setErrors] = useState({});
  const [habilidades, setHabilidades] = useState([]);
  const [componentes, setComponentes] = useState([]);
  const [anosEscolares, setAnosEscolares] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [generatedFileName, setGeneratedFileName] = useState('');
  const [generatedFileUrl, setGeneratedFileUrl] = useState('');
  const [loadingFinished, setLoadingFinished] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const tutorialUrl = "https://www.youtube.com/embed/F6Jsq2zHRN4?si=nScevufRJiUZONvG";

  const [isFirstAccess, setIsFirstAccess] = useState(false);

  // Verificar se é o primeiro acesso
  React.useEffect(() => {
    const hasSeenTour = localStorage.getItem('resumoTourCompleted');
    console.log('Tour status:', { hasSeenTour, isFirstAccess: !hasSeenTour });
    
    if (!hasSeenTour) {
      // PRIMEIRO ACESSO
      setIsFirstAccess(true);
    } else {
      // ACESSO RECORRENTE
      setIsFirstAccess(false);
    }
  }, []);

  React.useEffect(() => {
    const loadDados = async () => {
      try {
        const comps = await listarComponentes();
        setComponentes(comps.map(c => ({ value: c.nome, label: c.nome })));
        const anos = await listarAnosEscolares();
        setAnosEscolares(anos);
      } catch (err) {
        console.error('Erro ao carregar componentes ou anos', err);
      }
    };
    loadDados();
  }, []);

  React.useEffect(() => {
    const fetchHabilidades = async () => {
      try {
        const data = await buscarHabilidades();
        setHabilidades(data);
      } catch (error) {}
    };
    fetchHabilidades();
  }, [formData.anoTurma, formData.componente]);

  const habilidadesFiltradas = React.useMemo(() => {
    if (formData.anoTurma && formData.componente && habilidades.length > 0) {
      const [anoNumero, nivelSigla] = formData.anoTurma.split(' ');
      return habilidades.filter(h => {
        const hNumeroMatch = h.ano.startsWith(anoNumero);
        const hNivelMatch = (nivelSigla === 'EF' && h.ano.toLowerCase().includes('fundamental')) || (nivelSigla === 'EM' && h.ano.toLowerCase().includes('médio'));
        return hNumeroMatch && hNivelMatch && h.componente === formData.componente;
      }).map(h => ({ value: h.id, label: `${h.codigo_bncc} - ${h.objetos_de_conhecimento}`, codigo_bncc: h.codigo_bncc, habilidade_bncc: h.habilidade_bncc, unidades_tematicas: h.unidades_tematicas, objetos_de_conhecimento: h.objetos_de_conhecimento }));
    }
    return [];
  }, [formData.anoTurma, formData.componente, habilidades]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };
  const handleSelectChange = (field) => async (option) => {
    const val = option ? option.value : '';
    setFormData(prev => ({ ...prev, [field]: val }));
    if (field === 'componente') {
      setFormData(prev => ({ ...prev, anoTurma: '' }));
      try {
        const anos = await listarAnosEscolares(val);
        setAnosEscolares(anos);
      } catch (err) {
        console.error('Erro ao carregar anos', err);
      }
    }
  };
  const handleHabilidadeChange = (selectedOptions) => {
    const limitados = (selectedOptions || []).slice(0, 2);
    setFormData(prev => ({ ...prev, habilidade: limitados }));
  };
  const handleRemoveHabilidade = (habilidadeToRemove) => {
    setFormData(prev => ({ ...prev, habilidade: prev.habilidade.filter(h => h.value !== habilidadeToRemove.value) }));
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoadingFinished(false);
    const newErrors = {};
    if (!formData.titulo.trim()) newErrors.titulo = 'O nome do documento é obrigatório.';
    if (!formData.componente) newErrors.componente = 'Obrigatório';
    if (!formData.anoTurma) newErrors.anoTurma = 'Obrigatório';
    if (formData.habilidade.length === 0 && !formData.assunto.trim()) newErrors.assunto = 'O nome do documento é obrigatório.';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setIsLoading(true);
    const payload = {
      titulo: formData.titulo,
      anoEscolar: formData.anoTurma,
      componente: formData.componente,
      habilidade: formData.habilidade[0]?.value,
      assunto: formData.assunto,
    };

    try {
      const resp = await gerarResumo(payload);
      const url = URL.createObjectURL(resp.data || resp);
      setGeneratedFileUrl(url);
      setGeneratedFileName(`${formData.titulo}.docx`);
      setLoadingFinished(true);
      setIsLoading(false);
    } catch (error) {
      console.error('Erro ao gerar resumo:', error);
      alert('Erro ao gerar o resumo.');
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    if (loadingFinished && isLoading === false) {
      setShowSuccess(true);
    }
  }, [loadingFinished, isLoading]);

  const handleSuccessClose = () => {
    setShowSuccess(false);
    if (generatedFileUrl && generatedFileName) {
      const link = document.createElement('a');
      link.href = generatedFileUrl;
      link.download = generatedFileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(generatedFileUrl);
      setGeneratedFileUrl('');
      setGeneratedFileName('');
    }
  };



  return (
    <div className="page--resumo">
      <LoadingScreen
        isVisible={isLoading}
        title="Gerando resumo"
        subtitle="Aguarde enquanto criamos seu resumo personalizado..."
        primaryColor="#f59e42"
        icon={FileText}
        estimatedDuration={15000} // 15 segundos estimados para distribuição automática (mais rápido)
        adaptiveMode={true} // Ativa o modo adaptativo inteligente
        steps={[
          {
            id: 0,
            title: 'Analisando conteúdo',
            description: 'Processando informações do tema...',
            icon: BookOpen
          },
          {
            id: 1,
            title: 'Estruturando informações',
            description: 'Organizando conceitos principais...',
            icon: Target
          },
          {
            id: 2,
            title: 'Sintetizando conteúdo',
            description: 'Criando resumo conciso e claro...',
            icon: Lightbulb
          },
          {
            id: 3,
            title: 'Formatando documento',
            description: 'Preparando o arquivo final...',
            icon: Users
          }
        ]}
      />
      <SuccessAnimation
        isVisible={showSuccess}
        onClose={handleSuccessClose}
        fileName={generatedFileName}
        title="Resumo gerado!"
      />
      <div className="resumo-card">
        <div className="resumo-card-header" style={{ 
          flexDirection: isMobile ? 'column' : 'row'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 16,
            width: isMobile ? '100%' : 'auto'
          }}>
            <span style={{ 
              background: 'linear-gradient(135deg, #f59e42 0%, #fbbf24 100%)', 
              borderRadius: '16px', 
              padding: 10, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              width: isMobile ? 48 : 56, 
              height: isMobile ? 48 : 56,
              flexShrink: 0
            }}>
              <FileText size={isMobile ? 24 : 32} color="#fff" />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ 
                fontSize: isMobile ? 24 : 28, 
                fontWeight: 700, 
                margin: 0,
                lineHeight: 1.2
              }}>Resumo</h2>
              <p style={{ 
                color: '#666', 
                margin: 0, 
                fontSize: isMobile ? 14 : 16,
                lineHeight: 1.3
              }}>Gere resumos personalizados para qualquer tema.</p>
            </div>
          </div>
          <div style={{ 
            display: 'flex', 
            gap: '8px', 
            alignItems: 'center',
            width: isMobile ? '100%' : 'auto',
            justifyContent: isMobile ? 'center' : 'flex-end'
          }}>
            <TutorialButton id="tutorial-btn" onClick={() => setTutorialOpen(true)} label="Tutorial" />
          </div>
        </div>
        <TutorialModal open={tutorialOpen} onClose={() => setTutorialOpen(false)} videoUrl={tutorialUrl} videoTitle="Como gerar um resumo?" description="Assista ao vídeo abaixo para aprender, passo a passo, como gerar um resumo personalizado." />
        <form onSubmit={handleSubmit} className="pa-form" style={{ marginTop: 32 }}>
          <div className="form-group">
            <label className="form-label" htmlFor="titulo-input">
              Nome do Documento <span className="req">*</span>
            </label>
            <input
              id="titulo-input"
              name="titulo"
              className={`form-input ${errors?.titulo ? 'form-input--error' : ''}`}
              value={formData.titulo || ''}
              onChange={e => setFormData(prev => ({ ...prev, titulo: e.target.value }))}
              placeholder="Digite o nome do documento"
              required
              aria-invalid={errors?.titulo ? 'true' : 'false'}
              aria-describedby={errors?.titulo ? 'titulo-error' : null}
            />
            {errors?.titulo && (
              <p id="titulo-error" className="error-message" role="alert">{errors.titulo}</p>
            )}
          </div>
          <div className="pa-grid-2">
            <div className="form-group">
              <label className="form-label">Componente Curricular <span className="req">*</span></label>
              <Select
                id="componente-select"
                options={componentes}
                value={componentes.find(opt => opt.value === formData.componente) || null}
                onChange={handleSelectChange('componente')}
                placeholder="Selecione o componente curricular"
                isClearable
                className={`react-select altura-fixa ${errors?.componente ? 'has-error' : ''}`}
                classNamePrefix="react-select"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Ano / Turma <span className="req">*</span></label>
              <Select
                id="ano-turma-select"
                options={anosEscolares}
                value={anosEscolares.find(opt => opt.value === formData.anoTurma) || null}
                onChange={handleSelectChange('anoTurma')}
                placeholder="Selecione o ano/turma"
                isClearable
                className={`react-select altura-fixa ${errors?.anoTurma ? 'has-error' : ''}`}
                classNamePrefix="react-select"
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Habilidade / Objeto de Conhecimento</label>
            <AutocompleteHabilidade
              id="habilidade-select"
              options={habilidadesFiltradas}
              value={formData.habilidade}
              onChange={handleHabilidadeChange}
              isDisabled={!!formData.assunto?.trim()}
            />
            {formData.habilidade.length > 0 && (
              <div className="habilidade-info">
                {formData.habilidade.map((h, idx) => (
                  <HabilidadeCard key={h.value || h.id || idx} h={h} onRemove={handleRemoveHabilidade} />
                ))}
              </div>
            )}
          </div>
          <div style={{ display: 'none' }}>
            <label className="form-label" htmlFor="assunto-input" style={{ color: formData.habilidade.length > 0 ? '#b0b8c1' : undefined }}>
              Assunto do Documento {formData.habilidade.length === 0 ? '(obrigatório se não selecionar BNCC)' : '(você já selecionou a BNCC, não é necessário preencher este campo)'}
            </label>
            <textarea
              id="assunto-input"
              name="assunto"
              className="form-textarea"
              value={formData.assunto}
              onChange={handleChange}
              placeholder="Digite o assunto do documento"
              maxLength={1000}
              disabled={formData.habilidade.length > 0}
            />
            {errors.assunto && <span className="error-message">{errors.assunto}</span>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
            <button
              id="gerar-resumo-btn"
              type="submit"
              style={{ 
                background: '#F8AE34', 
                color: '#fff', 
                border: 'none', 
                borderRadius: 8, 
                padding: '10px 24px', 
                fontWeight: 600, 
                fontSize: 16, 
                boxShadow: '0 2px 8px #F8AE3422', 
                width: '100%', 
                maxWidth: 340,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                cursor: 'pointer'
              }}
              disabled={Object.keys(errors).length > 0}
            >
              Gerar Resumo
            </button>
          </div>
        </form>
        <div style={{ marginTop: 28, background: '#fff', borderRadius: 8, padding: 16, display: 'flex', alignItems: 'flex-start', gap: 10, justifyContent: 'center' }}>
          <Info size={22} color="#6c8ebf" style={{ marginTop: 2 }} />
          <span style={{ color: '#475569', fontSize: 14, lineHeight: 1.5 }}>
            Professor, sempre revise o conteúdo gerado antes de utilizar em sala de aula. Sua expertise e conhecimento são fundamentais para o sucesso dos alunos! ✨
          </span>
        </div>
      </div>
    </div>
  );
} 
