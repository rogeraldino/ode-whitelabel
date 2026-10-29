import React, { useEffect, useRef, useCallback, useState } from "react";

const TutorialModal = ({ open, onClose, videoUrl, videoTitle = "Como gerar uma lista de exercício?", description = "Assista ao vídeo abaixo para aprender, passo a passo, como gerar uma lista de exercícios personalizada.", youtubeUrl }) => {
  const closeBtnRef = useRef(null);
  const modalRef = useRef(null);
  const [loading, setLoading] = useState(false);

  // Focus trap
  useEffect(() => {
    if (!open) return;
    const focusable = modalRef.current.querySelectorAll('button, [tabindex]:not([tabindex="-1"])');
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    function handleTab(e) {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, [open]);

  // Fechar com ESC
  useEffect(() => {
    if (!open) return;
    function handleEsc(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  // Foco inicial
  useEffect(() => {
    if (open && closeBtnRef.current) {
      closeBtnRef.current.focus();
    }
  }, [open]);

  // Controlar a classe modal-open no body para o rodapé ficar em segundo plano
  useEffect(() => {
    if (open) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    
    // Cleanup ao desmontar o componente
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [open]);

  // Fechar ao clicar fora
  const handleOverlayClick = useCallback((e) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  // Loader do vídeo removido

  // Responsividade: botão maior em mobile
  const isMobile = window.innerWidth < 600;

  if (!open) return null;
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        minHeight: "100svh",
        height: "100dvh",
        background: "rgba(30, 41, 59, 0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        transition: "background 0.3s"
      }}
      tabIndex={-1}
      aria-modal="true"
      role="dialog"
      onClick={handleOverlayClick}
    >
      <div
        ref={modalRef}
        style={{
          background: "#ffffff",
          borderRadius: 12,
          padding: 0,
          maxWidth: 560,
          width: "90%",
          boxShadow: "0 10px 25px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
          position: "relative",
          overflow: "hidden",
          animation: "modalFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
          border: "1px solid #e2e8f0"
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Barra superior com título e botão de fechar */}
        <div
          style={{
            width: "100%",
            minHeight: 52,
            background: "#fafbfc",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTopLeftRadius: 12,
            borderTopRightRadius: 12,
            padding: isMobile ? "0 16px 0 20px" : "0 20px 0 24px",
            borderBottom: "1px solid #e2e8f0"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{
              width: "3px",
              height: "20px",
              background: "linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)",
              borderRadius: "2px"
            }}></div>
            <span style={{ 
              fontWeight: 600, 
              fontSize: 18, 
              color: "#1e293b", 
              fontFamily: 'Quicksand, sans-serif', 
              letterSpacing: "-0.01em",
              lineHeight: "1.3"
            }}>
              {videoTitle}
            </span>
          </div>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            aria-label="Fechar tutorial"
            style={{
              margin: 0,
              width: 32,
              height: 32,
              background: "rgba(100, 116, 139, 0.1)",
              border: "1px solid rgba(100, 116, 139, 0.2)",
              borderRadius: "8px",
              fontSize: 14,
              color: "#64748b",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s ease",
              fontWeight: "500"
            }}
            onMouseOver={e => {
              e.currentTarget.style.background = "#6366F1";
              e.currentTarget.style.color = "#ffffff";
              e.currentTarget.style.border = "1px solid #6366F1";
              e.currentTarget.style.transform = "scale(1.05)";
            }}
            onMouseOut={e => {
              e.currentTarget.style.background = "rgba(100, 116, 139, 0.1)";
              e.currentTarget.style.color = "#64748b";
              e.currentTarget.style.border = "1px solid rgba(100, 116, 139, 0.2)";
              e.currentTarget.style.transform = "scale(1)";
            }}
            onFocus={e => {
              e.currentTarget.style.outline = "2px solid #6366F1";
              e.currentTarget.style.outlineOffset = "2px";
            }}
            onBlur={e => {
              e.currentTarget.style.outline = "none";
            }}
          >
            &times;
          </button>
        </div>
        {/* Descrição abaixo do título */}
        <div style={{ 
          padding: isMobile ? "16px 20px 0 20px" : "18px 24px 0 24px", 
          fontSize: 15, 
          color: "#64748b", 
          fontFamily: 'Quicksand, sans-serif', 
          fontWeight: "400", 
          lineHeight: "1.5"
        }}>
          {description}
        </div>
        {/* Área do vídeo */}
        <div style={{
          position: "relative",
          paddingBottom: "56.25%",
          height: 0,
          background: "#f8fafc",
          borderBottomLeftRadius: 12,
          borderBottomRightRadius: 12,
          overflow: "hidden",
          marginTop: 16
        }}>
          <iframe
            src={videoUrl}
            title={videoTitle}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              border: "none",
              borderBottomLeftRadius: 12,
              borderBottomRightRadius: 12
            }}
          ></iframe>
        </div>
        {/* Botão Ver no YouTube */}
        {/* Instrução de fechamento */}
        <div style={{ 
          textAlign: 'center', 
          color: '#94a3b8', 
          fontSize: 13, 
          margin: isMobile ? '16px 0 20px 0' : '18px 0 22px 0', 
          fontFamily: 'Quicksand, sans-serif', 
          fontWeight: "400",
          padding: "0 24px"
        }}>
          Pressione <span style={{ 
            color: '#6366F1', 
            fontWeight: '500',
            background: "rgba(99, 102, 241, 0.1)",
            padding: "1px 4px",
            borderRadius: "3px",
            fontSize: "12px"
          }}>ESC</span> ou clique fora para fechar
        </div>
        {/* Animação */}
        <style>{`
          @keyframes modalFadeIn {
            from { 
              opacity: 0; 
              transform: translateY(20px) scale(0.98); 
            }
            to { 
              opacity: 1; 
              transform: translateY(0) scale(1); 
            }
          }
        `}</style>
      </div>
    </div>
  );
};

export default TutorialModal; 