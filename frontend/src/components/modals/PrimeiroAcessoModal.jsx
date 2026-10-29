import React, { useState, useEffect } from 'react';
import { atualizarCredenciais } from '../../services/Api.jsx';
import { useAuth } from '../../hooks/useAuth.jsx';
import InMemoryStorage from '../../services/InMemoryStorage.jsx';

const PrimeiroAcessoModal = () => {
    const [usuario, setUsuario] = useState('');
    const [senha, setSenha] = useState('');
    const [confirmarSenha, setConfirmarSenha] = useState('');
    const [erro, setErro] = useState('');
    const { mostrarModalPrimeiroAcesso, refreshUser, setMostrarModalPrimeiroAcesso } = useAuth();

    // Controlar a classe modal-open no body para o rodapé ficar em segundo plano
    useEffect(() => {
        if (mostrarModalPrimeiroAcesso) {
            document.body.classList.add('modal-open');
        } else {
            document.body.classList.remove('modal-open');
        }
        
        // Cleanup ao desmontar o componente
        return () => {
            document.body.classList.remove('modal-open');
        };
    }, [mostrarModalPrimeiroAcesso]);

    const validarSenha = (senha) => {
        const temMaiuscula = /[A-Z]/.test(senha);
        const temMinuscula = /[a-z]/.test(senha);
        const temNumero = /[0-9]/.test(senha);
        return senha.length >= 6 && temMaiuscula && temMinuscula && temNumero;
    };

    const avaliarRequisitosSenha = (senha, confirmarSenha) => ({
        tamanho: senha.length >= 6,
        maiuscula: /[A-Z]/.test(senha),
        minuscula: /[a-z]/.test(senha),
        numero: /[0-9]/.test(senha),
        iguais: senha === confirmarSenha && senha.length > 0
    });

    const requisitos = avaliarRequisitosSenha(senha, confirmarSenha);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!usuario || !senha || !confirmarSenha) {
            setErro('Preencha todos os campos');
            return;
        }

        if (senha !== confirmarSenha) {
            setErro('As senhas não coincidem.');
            return;
        }

        if (!validarSenha(senha)) {
            setErro('A senha não atende aos requisitos mínimos.');
            return;
        }

        try {
            await atualizarCredenciais({ usuario, senha });
            InMemoryStorage.removeItem('mostrarModalPrimeiroAcesso');
            await refreshUser();
            setMostrarModalPrimeiroAcesso(false);
        } catch (err) {
            if (err.response?.data?.erro) {
                setErro(err.response.data.erro);
            } else {
                setErro('Erro ao atualizar credenciais. Tente novamente.');
            }
            console.error(err);
        }
    };

    if (!mostrarModalPrimeiroAcesso) return null;

    return (
        <div style={modalOverlayStyle}>
            <div style={modalContentStyle}>
                <h2 style={{ marginBottom: '0.5rem' }}>Bem-vindo!</h2>
                <p style={{ marginBottom: '1rem', color: '#555' }}>
                    Antes de continuar, defina um nome de usuário e uma nova senha segura.
                </p>

                <form onSubmit={handleSubmit}>
                    <input
                        type="text"
                        placeholder="Nome de usuário"
                        value={usuario}
                        onChange={(e) => setUsuario(e.target.value)}
                        style={inputStyle}
                    />
                    <input
                        type="password"
                        placeholder="Nova senha"
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                        style={inputStyle}
                    />
                    <input
                        type="password"
                        placeholder="Confirmar senha"
                        value={confirmarSenha}
                        onChange={(e) => setConfirmarSenha(e.target.value)}
                        style={inputStyle}
                    />

                    <ul style={senhaDicaStyle}>
                        <li style={{ color: requisitos.tamanho ? 'green' : 'red' }}>
                            {requisitos.tamanho ? '✓' : '✗'} Mínimo 6 caracteres
                        </li>
                        <li style={{ color: requisitos.maiuscula ? 'green' : 'red' }}>
                            {requisitos.maiuscula ? '✓' : '✗'} Pelo menos 1 letra maiúscula
                        </li>
                        <li style={{ color: requisitos.minuscula ? 'green' : 'red' }}>
                            {requisitos.minuscula ? '✓' : '✗'} Pelo menos 1 letra minúscula
                        </li>
                        <li style={{ color: requisitos.numero ? 'green' : 'red' }}>
                            {requisitos.numero ? '✓' : '✗'} Pelo menos 1 número
                        </li>
                        <li style={{ color: requisitos.iguais ? 'green' : 'red' }}>
                            {requisitos.iguais ? '✓' : '✗'} Senhas iguais
                        </li>
                    </ul>


                    {erro && <p style={{ color: 'red', marginBottom: '0.5rem' }}>{erro}</p>}

                    <button type="submit" style={buttonStyle}>
                        Salvar e continuar
                    </button>
                </form>
            </div>
        </div>
    );
};

const modalOverlayStyle = {
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
    zIndex: 9999
};

const modalContentStyle = {
    backgroundColor: '#fff',
    padding: '2rem',
    borderRadius: '16px',
    boxShadow: '0 20px 45px rgba(0,0,0,0.2)',
    maxWidth: '420px',
    width: '90%',
    textAlign: 'center',
    animation: 'fadeIn 0.3s ease'
};

const inputStyle = {
    width: '100%',
    padding: '0.75rem',
    marginBottom: '0.75rem',
    borderRadius: '8px',
    border: '1px solid #ccc',
    fontSize: '1rem'
};

const buttonStyle = {
    width: '100%',
    padding: '0.75rem',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 'bold',
    cursor: 'pointer',
    fontSize: '1rem',
    transition: 'background 0.3s ease'
};

const senhaDicaStyle = {
    fontSize: '0.8rem',
    color: '#666',
    textAlign: 'left',
    marginBottom: '1rem',
    listStyleType: 'disc',
    paddingLeft: '1.2rem'
};

export default PrimeiroAcessoModal;
