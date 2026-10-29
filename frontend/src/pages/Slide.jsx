import React, { useState } from 'react';
import { Mic, Info, Presentation, Pencil } from 'lucide-react';
import Select from 'react-select';
import AutocompleteHabilidade from '../components/AutocompleteHabilidade';
import HabilidadeCard from '../components/HabilidadeCard';
import { buscarHabilidades } from '../services/Api.jsx';
import '../style/mobile-button-colors.css';

const opcoesDisciplinas = [
  { value: 'Matemática', label: 'Matemática' },
];
const opcoesAnoTurma = [
  { value: '1 EF', label: '1º ano Ensino Fundamental' },
  { value: '2 EF', label: '2º ano Ensino Fundamental' },
  { value: '3 EF', label: '3º ano Ensino Fundamental' },
  { value: '4 EF', label: '4º ano Ensino Fundamental' },
  { value: '5 EF', label: '5º ano Ensino Fundamental' },
  { value: '6 EF', label: '6º ano Ensino Fundamental' },
  { value: '7 EF', label: '7º ano Ensino Fundamental' },
  { value: '8 EF', label: '8º ano Ensino Fundamental' },
  { value: '9 EF', label: '9º ano Ensino Fundamental' },
  { value: '1 EM', label: '1º série Ensino Médio' },
  { value: '2 EM', label: '2º série Ensino Médio' },
  { value: '3 EM', label: '3º série Ensino Médio' },
];
const opcoesAreaTemaMatematica = [
  { value: 'Algebra', label: 'Álgebra' },
  { value: 'Geometria', label: 'Geometria' },
  // Adicione outras áreas/temas conforme necessário
];

export default function Slide() {
  const [formData, setFormData] = useState({
    assunto: '',
    anoEscolaridade: '',
    quantidadeSlides: 5,
    quantidadePersonalizada: '',
    contexto: '',
    componente: '',
    anoTurma: '',
    habilidade: [],
    areaTema: '',
  });
  const [errors, setErrors] = useState({});
  const [personalizadoAtivo, setPersonalizadoAtivo] = useState(false);
  const [habilidades, setHabilidades] = useState([]);

  const opcoesSlides = [5, 10, 15, 20, 25];

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

  const handleSlideClick = (qtd) => {
    setFormData((prev) => ({ ...prev, quantidadeSlides: qtd, quantidadePersonalizada: '' }));
    setPersonalizadoAtivo(false);
  };

  const handlePersonalizado = () => {
    setPersonalizadoAtivo(true);
    setFormData((prev) => ({ ...prev, quantidadeSlides: '', quantidadePersonalizada: '' }));
  };

  const handlePersonalizadoChange = (e) => {
    const value = e.target.value.replace(/\D/g, '');
    setFormData((prev) => ({ ...prev, quantidadePersonalizada: value, quantidadeSlides: value }));
  };

  const handleSelectChange = (field) => (option) => {
    if (field === 'componente') {
      setFormData(prev => ({
        ...prev,
        componente: option ? option.value : '',
        areaTema: '',
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: option ? option.value : '',
      }));
    }
  };
  const handleHabilidadeChange = (selectedOptions) => {
    const limitados = (selectedOptions || []).slice(0, 2);
    setFormData(prev => ({ ...prev, habilidade: limitados }));
  };
  const handleRemoveHabilidade = (habilidadeToRemove) => {
    setFormData(prev => ({ ...prev, habilidade: prev.habilidade.filter(h => h.value !== habilidadeToRemove.value) }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!formData.assunto.trim()) newErrors.assunto = 'O nome do documento é obrigatório.';
    if (!formData.quantidadeSlides || Number(formData.quantidadeSlides) < 1) newErrors.quantidadeSlides = 'Informe a quantidade de slides.';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;
    alert('Apresentação gerada com sucesso! (mock)');
  };

  return (
    <div className="gerar-atividades">
      <div className="gerar-atividades__card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
          <span style={{ background: 'linear-gradient(135deg, #f43f5e 0%, #f87171 100%)', borderRadius: '16px', padding: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56 }}>
            <Presentation size={32} color="#fff" />
          </span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 22, marginBottom: 2 }}>Apresentação de Slides</div>
            <div style={{ color: '#6b7280', fontSize: 15 }}>Produza slides alinhados ao tema e prontos para baixar.</div>
          </div>
        </div>
        {/* Nome do Documento */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontWeight: 600, fontSize: 15 }}>Nome do Documento <span style={{ color: '#f26a1b' }}>*</span></label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              type="text"
              name="assunto"
              value={formData.assunto}
              onChange={handleChange}
              placeholder="Digite o nome do documento"
              style={{ width: '100%', borderRadius: 8, border: '1px solid #dde3ea', padding: '12px 14px', fontSize: 16, outline: 'none' }}
            />
          </div>
          {errors.assunto && <span style={{ color: '#f26a1b', fontSize: 13 }}>{errors.assunto}</span>}
        </div>
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontWeight: 600 }}>Componente Curricular <span style={{color:'#f26a1b'}}>*</span></label>
            <Select
              options={opcoesDisciplinas}
              value={opcoesDisciplinas.find(opt => opt.value === formData.componente) || null}
              onChange={handleSelectChange('componente')}
              placeholder="Digite ou selecione..."
              isClearable
              styles={{
                control: (base) => ({
                  ...base,
                  minHeight: 48,
                  fontSize: 16,
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                }),
                valueContainer: (base) => ({
                  ...base,
                  display: 'flex',
                  alignItems: 'center',
                  height: 48,
                  paddingTop: 0,
                  paddingBottom: 0,
                }),
                placeholder: (base) => ({
                  ...base,
                  display: 'flex',
                  alignItems: 'center',
                  height: 48,
                  margin: 0,
                }),
                singleValue: (base) => ({
                  ...base,
                  display: 'flex',
                  alignItems: 'center',
                  height: 48,
                  margin: 0,
                }),
                input: (base) => ({
                  ...base,
                  margin: 0,
                  padding: 0,
                  lineHeight: '48px',
                }),
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontWeight: 600 }}>Ano / Turma <span style={{color:'#f26a1b'}}>*</span></label>
            <Select
              options={opcoesAnoTurma}
              value={opcoesAnoTurma.find(opt => opt.value === formData.anoTurma) || null}
              onChange={handleSelectChange('anoTurma')}
              placeholder="Selecione o ano/turma"
              isClearable
              styles={{
                control: (base) => ({
                  ...base,
                  minHeight: 48,
                  fontSize: 16,
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                }),
                valueContainer: (base) => ({
                  ...base,
                  display: 'flex',
                  alignItems: 'center',
                  height: 48,
                  paddingTop: 0,
                  paddingBottom: 0,
                }),
                placeholder: (base) => ({
                  ...base,
                  display: 'flex',
                  alignItems: 'center',
                  height: 48,
                  margin: 0,
                }),
                singleValue: (base) => ({
                  ...base,
                  display: 'flex',
                  alignItems: 'center',
                  height: 48,
                  margin: 0,
                }),
                input: (base) => ({
                  ...base,
                  margin: 0,
                  padding: 0,
                  lineHeight: '48px',
                }),
              }}
            />
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontWeight: 600 }}>Habilidade / Objeto de Conhecimento</label>
          <AutocompleteHabilidade
            options={habilidadesFiltradas}
            value={formData.habilidade}
            onChange={handleHabilidadeChange}
          />
          {formData.habilidade.length > 0 && (
            <div className="habilidade-info">
              {formData.habilidade.map((h, idx) => (
                <HabilidadeCard key={h.value || h.id || idx} h={h} onRemove={handleRemoveHabilidade} />
              ))}
            </div>
          )}
        </div>
        <form onSubmit={handleSubmit} style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 28 }}>
          {/* Número de slides */}
          <div>
            <label style={{ fontWeight: 600, fontSize: 15 }}>Número de slides <span style={{ color: '#888', fontWeight: 400 }}>(Opcional)</span></label>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
              {opcoesSlides.map((qtd) => (
                <button
                  type="button"
                  key={qtd}
                  onClick={() => handleSlideClick(qtd)}
                  style={{
                    padding: '6px 18px',
                    borderRadius: 20,
                    border: '1.5px solid',
                    borderColor: formData.quantidadeSlides == qtd && !personalizadoAtivo ? '#F55767' : '#dde3ea',
                    background: formData.quantidadeSlides == qtd && !personalizadoAtivo ? '#fde6e9' : '#fff',
                    color: formData.quantidadeSlides == qtd && !personalizadoAtivo ? '#222' : '#666',
                    fontWeight: 500,
                    fontSize: 15,
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  {qtd}
                </button>
              ))}
              <button
                type="button"
                onClick={handlePersonalizado}
                style={{
                  padding: '6px 18px',
                  borderRadius: 20,
                  border: '1.5px solid',
                  borderColor: personalizadoAtivo ? '#F55767' : '#dde3ea',
                  background: personalizadoAtivo ? '#fde6e9' : '#fff',
                  color: personalizadoAtivo ? '#222' : '#666',
                  fontWeight: 500,
                  fontSize: 15,
                  cursor: 'pointer',
                  outline: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Pencil size={16} style={{ marginRight: 2 }} /> Personalizado
              </button>
              {personalizadoAtivo && (
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={formData.quantidadePersonalizada}
                  onChange={handlePersonalizadoChange}
                  placeholder="Qtd."
                  style={{ width: 60, borderRadius: 8, border: '1px solid #dde3ea', padding: '6px 8px', fontSize: 15, marginLeft: 4 }}
                />
              )}
            </div>
            {errors.quantidadeSlides && <span style={{ color: '#f26a1b', fontSize: 13 }}>{errors.quantidadeSlides}</span>}
          </div>
          <button
            type="submit"
            style={{ marginTop: 10, background: '#F55767', color: '#fff', border: 'none', borderRadius: 8, padding: '14px 0', fontWeight: 700, fontSize: 17, boxShadow: '0 2px 8px #F5576722', cursor: 'pointer', transition: 'background .2s' }}
            disabled={Object.keys(errors).length > 0}
          >
            Gerar apresentação
          </button>
        </form>
        <div style={{ marginTop: 28, color: '#8a8a8a', fontSize: 13, textAlign: 'center' }}>
          Professor, lembre-se de revisar o conteúdo antes de usar o material. O especialista no tema é você :)
        </div>
      </div>
    </div>
  );
} 