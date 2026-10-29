import React, { useEffect, useMemo, useState } from 'react';
import '../style/planoAula.css';            // ✅ novo CSS exclusivo
import '../style/habilidadeCard.css';
import '../style/tour-button-mobile.css';
import '../style/mobile-button-colors.css';
import Select from 'react-select';
import { BookOpen, Target, Lightbulb, Users } from 'lucide-react';
import LoadingScreen from '../components/LoadingScreen';
import SuccessAnimation from '../components/SuccessAnimation';
import TutorialButton from '../components/TutorialButton';
import TutorialModal from '../components/TutorialModal';
import { useAuth } from '../hooks/useAuth';
import {
  buscarHabilidades,
  listarComponentes,
  listarCompetenciasGerais,
  listarCompetenciasEspecificas,
  competenciasDaHabilidade,
  listarMetodologias,
  listarAnosEscolares,
  criarPlanoDeAula,
} from '../services/Api.jsx';

export default function PlanoDeAulaGerador() {
  const { user } = useAuth();
  console.log('Usuário no PlanoDeAulaGerador:', user);
  console.log('Funcionalidades do usuário:', user?.funcionalidades);
  if (user && !user.funcionalidades?.includes('gerar-plano-de-aula')) {
    console.log('Usuário não tem permissão para gerar plano de aula');
    return <div className="p-4 text-center text-gray-500">Funcionalidade não disponível para seu perfil.</div>;
  }

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkIsMobile = () => setIsMobile(window.innerWidth <= 768);
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  const [componentes, setComponentes] = useState([]);
  const [habilidades, setHabilidades] = useState([]);
  const [opcoesCG, setOpcoesCG] = useState([]);
  const [opcoesCE, setOpcoesCE] = useState([]);
  const [metodologias, setMetodologias] = useState([]);
  const [anosEscolares, setAnosEscolares] = useState([]);

  const [formData, setFormData] = useState({
    titulo: '',
    componente: null,
    anoEscolar: '',
    habilidade: null,
    metodologia: null,
    competenciaGeral: [],
    competenciaEspecifica: [],
    contexto: '',
  });
  const [errors, setErrors] = useState({});
  const [tocado, setTocado] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [generatedFileName, setGeneratedFileName] = useState('');
  const [generatedFileUrl, setGeneratedFileUrl] = useState('');
  const [loadingFinished, setLoadingFinished] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const tutorialUrl = "https://www.youtube.com/embed/qngT75ezASw?si=nScevufRJiUZONvG";

  const [isFirstAccess, setIsFirstAccess] = useState(false);

  useEffect(() => {
    const hasSeenTour = localStorage.getItem('planoDeAulaTourCompleted');
    if (!hasSeenTour) {
      setIsFirstAccess(true);
    } else {
      setIsFirstAccess(false);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const comps = await listarComponentes();
        setComponentes(comps.map(c => ({ value: c.id, label: c.nome })));
        setHabilidades(await buscarHabilidades());
        const anos = await listarAnosEscolares();
        setAnosEscolares(anos);
        const mets = await listarMetodologias();
        setMetodologias(mets.map(m => ({ value: m.id, label: `${m.tipo} - ${m.nome}` })));
      } catch (err) {
        console.error('Erro ao carregar dados', err);
      }
    };
    load();
  }, []);

  const habilidadesFiltradas = useMemo(() => {
    if (!formData.componente || !formData.anoEscolar) return [];
    const [anoNumero, nivelSigla] = formData.anoEscolar.split(' ');
    return habilidades
        .filter(h => {
          const num = h.ano.startsWith(anoNumero);
          const nivelMatch =
              (nivelSigla === 'EF' && h.ano.toLowerCase().includes('fundamental')) ||
              (nivelSigla === 'EM' && h.ano.toLowerCase().includes('médio'));
          return num && nivelMatch && h.componente === formData.componente.label;
        })
        .map(h => ({ value: h.id, label: `${h.codigo_bncc} - ${h.objetos_de_conhecimento}`, ...h }));
  }, [formData.componente, formData.anoEscolar, habilidades]);

  useEffect(() => {
    const atualizarCompetencias = async () => {
      if (!formData.componente || !formData.anoEscolar) return;
      setFormData(prev => ({ ...prev, competenciaGeral: [], competenciaEspecifica: [] }));

      if (formData.habilidade) {
        try {
          const data = await competenciasDaHabilidade(formData.habilidade.value);
          if (data.gerais.length || data.especificas.length) {
            const cgOptsHab = data.gerais.map(c => ({ value: c.id, label: `${c.numero} - ${c.nome}` }));
            const ceOpts = data.especificas.map(c => ({ value: c.id, label: `${c.numero} - ${c.descricao}` }));

            const compId = formData.componente.value;
            const cgTodos = await listarCompetenciasGerais(compId);
            const cgAllOpts = cgTodos.map(c => ({ value: c.id, label: `${c.numero} - ${c.nome}` }));
            const mergedCG = [...cgOptsHab];
            cgAllOpts.forEach(opt => { if (!mergedCG.some(c => c.value === opt.value)) mergedCG.push(opt); });

            setOpcoesCG(mergedCG);
            setOpcoesCE(ceOpts);
            setFormData(prev => ({ ...prev, competenciaGeral: cgOptsHab, competenciaEspecifica: ceOpts }));
            return;
          }
        } catch (err) {
          console.error('Erro ao carregar competências da habilidade', err);
        }
      }
      try {
        const compId = formData.componente.value;
        const nivel = formData.anoEscolar.includes('EM') ? 'Médio' : 'Fundamental';
        const cg = await listarCompetenciasGerais(compId);
        const ce = await listarCompetenciasEspecificas(compId, nivel);
        setOpcoesCG(cg.map(c => ({ value: c.id, label: `${c.numero} - ${c.nome}` })));
        setOpcoesCE(ce.map(c => ({ value: c.id, label: `${c.numero} - ${c.descricao}` })));
      } catch (err) {
        console.error('Erro ao carregar competências', err);
      }
    };
    atualizarCompetencias();
  }, [formData.habilidade, formData.componente, formData.anoEscolar]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('handleSubmit chamado');
    setLoadingFinished(false);
    setTocado({
      titulo: true, componente: true, anoEscolar: true, habilidade: true,
      metodologia: true, competenciaGeral: true, competenciaEspecifica: true
    });

    const newErrors = {};
    if (!formData.titulo.trim()) newErrors.titulo = 'O nome do documento é obrigatório.';
    if (!formData.componente) newErrors.componente = 'O componente curricular é obrigatório.';
    if (!formData.anoEscolar) newErrors.anoEscolar = 'O ano escolar é obrigatório.';
    if (!formData.habilidade) newErrors.habilidade = 'Selecione ao menos uma habilidade.';
    if (!formData.metodologia) newErrors.metodologia = 'A metodologia é obrigatória.';
    if (formData.competenciaGeral.length === 0) newErrors.competenciaGeral = 'Selecione ao menos uma competência geral.';
    if (formData.competenciaEspecifica.length === 0) newErrors.competenciaEspecifica = 'Selecione ao menos uma competência específica.';
    setErrors(newErrors);

    console.log('Erros de validação:', newErrors);
    console.log('FormData:', formData);

    if (Object.keys(newErrors).length === 0) {
      console.log('Iniciando criação do plano...');
      setIsLoading(true);
      const payload = {
        titulo: formData.titulo,
        componente: formData.componente.value,
        anoEscolar: formData.anoEscolar,
        habilidade: formData.habilidade.value,
        competencias_gerais: formData.competenciaGeral.map(c => c.value),
        competencias_especificas: formData.competenciaEspecifica.map(c => c.value),
        metodologia: formData.metodologia.value,
        observacao: formData.contexto,
      };
      console.log('Payload enviado:', payload);
      try {
        const resp = await criarPlanoDeAula(payload);
        console.log('Resposta recebida:', resp);
        const url = URL.createObjectURL(resp.data || resp);
        setGeneratedFileUrl(url);
        setGeneratedFileName(`${formData.titulo}.docx`);
        setLoadingFinished(true);
        setIsLoading(false);
      } catch (error) {
        console.error('Erro ao salvar plano:', error);
        alert('Erro ao salvar o plano de aula.');
        setIsLoading(false);
      }
    } else {
      console.log('Formulário com erros, não enviando');
    }
  };

  useEffect(() => {
    if (loadingFinished && isLoading === false) setShowSuccess(true);
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
      <div className="plano-aula">


        <LoadingScreen
            isVisible={isLoading}
            title="Gerando plano de aula"
            subtitle="Aguarde enquanto criamos seu plano personalizado..."
            primaryColor="#8B5CF6"
            icon={BookOpen}
            estimatedDuration={18000}
            adaptiveMode={true}
            steps={[
              { id: 0, title: 'Analisando parâmetros', description: 'Processando informações do plano de aula...', icon: BookOpen },
              { id: 1, title: 'Definindo objetivos', description: 'Criando objetivos de aprendizagem...', icon: Target },
              { id: 2, title: 'Planejando atividades', description: 'Desenvolvendo atividades interativas...', icon: Lightbulb },
              { id: 3, title: 'Organizando recursos', description: 'Preparando materiais e recursos...', icon: Users }
            ]}
        />

        <SuccessAnimation
            isVisible={showSuccess}
            onClose={handleSuccessClose}
            fileName={generatedFileName}
            title="Plano de Aula Gerado!"
        />

        <div className="pa-card">
          {/* Header */}
          <div className="pa-card-header">
            <div className="pa-header-left">
            <span className="pa-header-badge">
              <BookOpen color="#fff" size={32} />
            </span>
              <div>
                <h2 className="pa-title">Plano de Aula</h2>
                <p className="pa-subtitle">Gere planos completos com objetivos, metodologia e avaliação.</p>
              </div>
            </div>
            <div className="pa-header-actions">
              <TutorialButton id="tutorial-btn" onClick={() => setTutorialOpen(true)} label="Tutorial" />
            </div>
          </div>

          <TutorialModal
              open={tutorialOpen}
              onClose={() => setTutorialOpen(false)}
              videoUrl={tutorialUrl}
              videoTitle="Como gerar um plano de aula?"
              description="Aprenda a criar um plano de aula completo e personalizado para sua turma."
          />

          {/* Form */}
          <form onSubmit={handleSubmit} className="pa-form">
            <div className="form-group">
              <label className="form-label">Nome do Documento <span className="req">*</span></label>
              <input
                  id="nome-documento"
                  type="text"
                  name="titulo"
                  value={formData.titulo}
                  onChange={e => {
                    setFormData(prev => ({ ...prev, titulo: e.target.value }));
                    if (errors.titulo) setErrors(prev => ({ ...prev, titulo: null }));
                  }}
                  onBlur={() => setTocado(prev => ({ ...prev, titulo: true }))}
                  placeholder="Digite o nome do documento"
                  className={`form-input ${errors.titulo && tocado.titulo ? 'form-input--error' : ''}`}
                  aria-invalid={errors.titulo && tocado.titulo ? 'true' : 'false'}
                  aria-describedby={errors.titulo && tocado.titulo ? 'titulo-error' : null}
              />
              {errors.titulo && tocado.titulo && (
                  <p id="titulo-error" className="error-message" role="alert">{errors.titulo}</p>
              )}
            </div>

            <div className="pa-grid-2">
              <div className="form-group">
                <label className="form-label">Componente Curricular <span className="req">*</span></label>
                <Select
                    id="componente-curricular"
                    options={componentes}
                    value={formData.componente}
                    onChange={async opt => {
                      setFormData(prev => ({ ...prev, componente: opt, habilidade: null, anoEscolar: '' }));
                      const compId = opt ? opt.value : null;
                      try {
                        const anos = await listarAnosEscolares(compId);
                        setAnosEscolares(anos);
                      } catch (err) { console.error('Erro ao filtrar anos', err); }
                      if (errors.componente) setErrors(prev => ({ ...prev, componente: null }));
                    }}
                    onBlur={() => setTocado(prev => ({ ...prev, componente: true }))}
                    className={`react-select altura-fixa ${errors.componente && tocado.componente ? 'has-error' : ''}`}
                    classNamePrefix="react-select"
                    placeholder="Selecione..."
                    isClearable
                />
                {errors.componente && tocado.componente && (
                    <p className="error-message" role="alert">{errors.componente}</p>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Ano / Turma <span className="req">*</span></label>
                <Select
                    id="ano-turma"
                    options={anosEscolares}
                    value={anosEscolares.find(opt => opt.value === formData.anoEscolar) || null}
                    onChange={opt => {
                      setFormData(prev => ({ ...prev, anoEscolar: opt ? opt.value : '', habilidade: null }));
                      if (errors.anoEscolar) setErrors(prev => ({ ...prev, anoEscolar: null }));
                    }}
                    onBlur={() => setTocado(prev => ({ ...prev, anoEscolar: true }))}
                    className={`react-select altura-fixa ${errors.anoEscolar && tocado.anoEscolar ? 'has-error' : ''}`}
                    classNamePrefix="react-select"
                    placeholder="Selecione..."
                    isClearable
                />
                {errors.anoEscolar && tocado.anoEscolar && (
                    <p className="error-message" role="alert">{errors.anoEscolar}</p>
                )}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Habilidade / Objeto de Conhecimento <span className="req">*</span></label>
              <Select
                  id="habilidade-select"
                  options={habilidadesFiltradas}
                  value={formData.habilidade}
                  onChange={opt => {
                    setFormData(prev => ({ ...prev, habilidade: opt, competenciaGeral: [], competenciaEspecifica: [] }));
                    if (errors.habilidade) setErrors(prev => ({ ...prev, habilidade: null }));
                  }}
                  onBlur={() => setTocado(prev => ({ ...prev, habilidade: true }))}
                  className={`react-select altura-fixa ${errors.habilidade && tocado.habilidade ? 'has-error' : ''}`}
                  classNamePrefix="react-select"
                  placeholder="Selecione..."
                  isClearable
              />
              {errors.habilidade && tocado.habilidade && (
                  <p className="error-message" role="alert">{errors.habilidade}</p>
              )}

              {formData.habilidade && (
                  <div className="habilidade-info">
                    <div className="habilidade-card pa-hab-card">
                      <div className="habilidade-card__codigo pa-hab-card__codigo">
                        {formData.habilidade.codigo_bncc}
                      </div>
                      <div className="habilidade-details pa-hab-details">
                        <div className="pa-hab-row">
                          <strong>Habilidade: </strong>
                          <span>{formData.habilidade.habilidade_bncc || '(descrição indisponível)'}</span>
                        </div>
                        <div className="pa-hab-row">
                          <strong>Unidade Temática: </strong>
                          <span>{formData.habilidade.unidades_tematicas || '(sem unidade)'}</span>
                        </div>
                        <div className="pa-hab-row">
                          <strong>Objeto Conhecimento: </strong>
                          <span>{formData.habilidade.objetos_de_conhecimento || '(sem objeto)'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Competências Gerais <span className="req">*</span></label>
              <Select
                  id="competencias-gerais"
                  isMulti
                  options={opcoesCG}
                  value={formData.competenciaGeral}
                  onChange={opt => {
                    setFormData(prev => ({ ...prev, competenciaGeral: opt || [] }));
                    if (errors.competenciaGeral) setErrors(prev => ({ ...prev, competenciaGeral: null }));
                  }}
                  onBlur={() => setTocado(prev => ({ ...prev, competenciaGeral: true }))}
                  className={`react-select rs-multi ${errors.competenciaGeral && tocado.competenciaGeral ? 'has-error' : ''}`}
                  classNamePrefix="react-select"
                  placeholder="Selecione..."
              />
              {errors.competenciaGeral && tocado.competenciaGeral && (
                  <p className="error-message" role="alert">{errors.competenciaGeral}</p>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Competências Específicas <span className="req">*</span></label>
              <Select
                  id="competencias-especificas"
                  isMulti
                  options={opcoesCE}
                  value={formData.competenciaEspecifica}
                  onChange={opt => {
                    setFormData(prev => ({ ...prev, competenciaEspecifica: opt || [] }));
                    if (errors.competenciaEspecifica) setErrors(prev => ({ ...prev, competenciaEspecifica: null }));
                  }}
                  onBlur={() => setTocado(prev => ({ ...prev, competenciaEspecifica: true }))}
                  className={`react-select rs-multi ${errors.competenciaEspecifica && tocado.competenciaEspecifica ? 'has-error' : ''}`}
                  classNamePrefix="react-select"
                  placeholder="Selecione..."
              />
              {errors.competenciaEspecifica && tocado.competenciaEspecifica && (
                  <p className="error-message" role="alert">{errors.competenciaEspecifica}</p>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Metodologia <span className="req">*</span></label>
              <Select
                  id="metodologia-select"
                  options={metodologias}
                  value={formData.metodologia}
                  onChange={opt => {
                    setFormData(prev => ({ ...prev, metodologia: opt }));
                    if (errors.metodologia) setErrors(prev => ({ ...prev, metodologia: null }));
                  }}
                  onBlur={() => setTocado(prev => ({ ...prev, metodologia: true }))}
                  className={`react-select altura-fixa ${errors.metodologia && tocado.metodologia ? 'has-error' : ''}`}
                  classNamePrefix="react-select"
                  placeholder="Selecione..."
                  isClearable
              />
              {errors.metodologia && tocado.metodologia && (
                  <p className="error-message" role="alert">{errors.metodologia}</p>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Contexto <span className="optional-label">(Opcional)</span></label>
              <textarea
                  name="contexto"
                  value={formData.contexto}
                  onChange={e => setFormData(prev => ({ ...prev, contexto: e.target.value }))}
                  className="form-textarea"
                  placeholder="Descreva o contexto da aula..."
              />
            </div>

            <div className="pa-actions-centered">
              <button
                  id="gerar-plano-btn"
                  type="submit"
                  className={`btn-pa-primary btn-pa-submit ${isLoading ? 'is-loading' : ''}`}
                  disabled={isLoading}
              >
                {isLoading ? 'Gerando...' : 'Gerar Plano de Aula'}
              </button>
            </div>
          </form>
        </div>
      </div>
  );
}
