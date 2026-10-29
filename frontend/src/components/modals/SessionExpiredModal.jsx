//frontend/src/components/modals/SessionExpiredModal.jsx
import React, { useState, useEffect } from 'react';
import { useSessionExpired } from '../../hooks/useSessionExpired.jsx';

const SessionExpiredModal = () => {
    const { expired, setExpired } = useSessionExpired();
    const [visible, setVisible] = useState(false);

    // Controla animação de entrada
    useEffect(() => {
        if (expired) {
            setVisible(true);
        } else {
            setVisible(false);
        }
    }, [expired]);

    // Controlar a classe modal-open no body para o rodapé ficar em segundo plano
    useEffect(() => {
        if (expired && visible) {
            document.body.classList.add('modal-open');
        } else {
            document.body.classList.remove('modal-open');
        }
        
        // Cleanup ao desmontar o componente
        return () => {
            document.body.classList.remove('modal-open');
        };
    }, [expired, visible]);

    if (!expired && !visible) return null;

    const handleClose = () => {
        setVisible(false);
        setTimeout(() => setExpired(false), 200); // espera a animação terminar
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            minHeight: '100svh',
            height: '100dvh',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            transition: 'opacity 0.2s ease-in-out',
            opacity: visible ? 1 : 0,
            pointerEvents: visible ? 'auto' : 'none'
        }}>
            <div style={{
                backgroundColor: 'white',
                padding: '2rem',
                borderRadius: '12px',
                boxShadow: '0 15px 35px rgba(0,0,0,0.3)',
                maxWidth: '400px',
                width: '90%',
                textAlign: 'center',
                transform: visible ? 'scale(1)' : 'scale(0.95)',
                transition: 'transform 0.2s ease-in-out',
            }}>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: '#333' }}>Sessão expirada</h2>
                <p style={{ marginBottom: '0.5rem', color: '#555' }}>
                    Você foi desconectado porque a conta foi acessada em outro dispositivo.
                </p>
                <p style={{ marginBottom: '1rem', color: '#555' }}>
                    Faça login novamente para continuar.
                </p>
                <button
                    onClick={handleClose}
                    style={{
                        padding: '0.6rem 1.2rem',
                        backgroundColor: '#F26A1B',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        transition: 'background 0.2s ease-in-out'
                    }}
                    onMouseOver={(e) => (e.target.style.backgroundColor = '#d65a13')}
                    onMouseOut={(e) => (e.target.style.backgroundColor = '#F26A1B')}
                >
                    Fechar
                </button>
            </div>
        </div>
    );
};

export default SessionExpiredModal;
