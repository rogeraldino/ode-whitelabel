import React from 'react';

const tiposInfo = {
  objetiva: {
    label: 'Objetiva',
    subtitle: 'Múltipla escolha',
    desc: 'Questões com alternativas A, B, C, D para seleção única. Ideais para avaliações rápidas e objetivas.',
    color: 'var(--app-blue)',
    bg: '#f8fafc',
    hoverBg: '#e2e8f0',
    selectedBg: '#eff6ff',
    selectedBorder: 'var(--app-blue)',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="8" r="1"/>
        <circle cx="8" cy="12" r="1"/>
        <circle cx="8" cy="16" r="1"/>
        <path d="M12 8h4M12 12h4M12 16h4"/>
        <rect x="3" y="3" width="18" height="18" rx="2"/>
      </svg>
    )
  },
  discursiva: {
    label: 'Discursiva',
    subtitle: 'Resposta livre',
    desc: 'Questões abertas que permitem respostas elaboradas. Estimulam o desenvolvimento do pensamento crítico e argumentativo.',
    color: 'var(--app-orange)',
    bg: '#f8fafc',
    hoverBg: '#fef3c7',
    selectedBg: '#fff7ed',
    selectedBorder: 'var(--app-orange)',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="M8 7h8M12 15h6"/>
      </svg>
    )
  }
};

export default function TipoQuestaoCard({ tipo, checked, onClick }) {
  const info = tiposInfo[tipo];
  return (
    <div
      style={{
        background: checked ? info.selectedBg : info.bg,
        border: checked ? `2px solid ${info.selectedBorder}` : '1px solid #e2e8f0',
        boxShadow: checked ? `0 4px 12px ${info.selectedBorder}20` : '0 1px 3px rgba(0,0,0,0.08)',
        borderRadius: '16px',
        padding: '20px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '16px',
        cursor: 'pointer',
        minWidth: '200px',
        minHeight: '120px',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative',
        flex: 1,
        transform: checked ? 'translateY(-2px)' : 'translateY(0)',
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (!checked) {
          const card = e.currentTarget;
          card.style.background = info.hoverBg;
          card.style.transform = 'translateY(-1px)';
          card.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)';
        }
      }}
      onMouseLeave={(e) => {
        if (!checked) {
          const card = e.currentTarget;
          card.style.background = info.bg;
          card.style.transform = 'translateY(0)';
          card.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
        }
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        readOnly
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
        tabIndex={-1}
        aria-hidden="true"
      />

      <span style={{
        width: '48px',
        height: '48px',
        borderRadius: '12px',
        background: checked ? info.selectedBorder : '#f1f5f9',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: checked ? '#fff' : '#64748b',
        transition: 'all 0.3s ease',
        flexShrink: 0
      }}>
        {info.icon}
      </span>
      
      <div style={{ flex: 1 }}>
        <div style={{
          fontWeight: '700',
          fontSize: '16px',
          color: checked ? info.selectedBorder : '#1e293b',
          marginBottom: '4px',
          transition: 'color 0.3s ease'
        }}>
          {info.label}
        </div>
        <div style={{
          color: '#64748b',
          fontWeight: '500',
          fontSize: '14px',
          marginBottom: '8px',
          transition: 'color 0.3s ease'
        }}>
          {info.subtitle}
        </div>
        <div style={{
          color: '#475569',
          fontWeight: '400',
          fontSize: '13px',
          lineHeight: '1.5',
          transition: 'color 0.3s ease'
        }}>
          {info.desc}
        </div>
      </div>
      
      {checked && (
        <div style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          background: info.selectedBorder,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: '14px'
        }}>
          ✓
        </div>
      )}
    </div>
  );
}