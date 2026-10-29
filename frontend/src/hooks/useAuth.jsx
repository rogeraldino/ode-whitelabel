import { useState, useEffect, createContext, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    buscarDadosUsuario,
    fazerLogin as loginService,
    logoutService,
    refreshToken
} from '../services/Api.jsx';
import { useSessionExpired } from './useSessionExpired';
import InMemoryStorage from '../services/InMemoryStorage.jsx';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [mostrarModalPrimeiroAcesso, setMostrarModalPrimeiroAcesso] = useState(false);
    const navigate = useNavigate();
    const { expired } = useSessionExpired();

    useEffect(() => {
        const checkAuth = async () => {
            console.log('Auth: checkAuth iniciado.');

            const savedUser = sessionStorage.getItem('user');
            if (savedUser) {
                try {
                    const parsedUser = JSON.parse(savedUser);
                    if (parsedUser.isAuthenticated) {
                        setUser(parsedUser);
                        console.log('Auth: Usuário restaurado do sessionStorage.');
                    }
                } catch (e) {
                    console.error('Auth: Erro ao parsear user do sessionStorage', e);
                    sessionStorage.removeItem('user');
                }
            }

            try {
                console.log('Auth: Tentando refreshToken() para verificar sessão...');
                await refreshToken();
                console.log('Auth: refreshToken() concluído. Tentando buscarDadosUsuario()...');
                const apiUser = await buscarDadosUsuario();
                const isIncomplete = apiUser?.usuario === null;
                const userCompleto = { isAuthenticated: true, ...apiUser };
                setUser(userCompleto);
                sessionStorage.setItem('user', JSON.stringify(userCompleto)); // <-- adicionado


                if (apiUser.primeiro_acesso || isIncomplete) {
                    setMostrarModalPrimeiroAcesso(true);
                    InMemoryStorage.setItem('mostrarModalPrimeiroAcesso', 'true');
                }
            } catch (error) {
                console.error('Auth: Erro durante checkAuth (refresh/fetch user):', error);
                setUser(null);
                sessionStorage.removeItem('user');
            } finally {
                setLoading(false);
            }
        };
        checkAuth();
    }, []);

    const refreshUser = async () => {
        try {
            const apiUser = await buscarDadosUsuario();
            const userCompleto = { isAuthenticated: true, ...apiUser };
            setUser(userCompleto);
            sessionStorage.setItem('user', JSON.stringify(userCompleto));
            setMostrarModalPrimeiroAcesso(apiUser.usuario === null);
        } catch (error) {
            console.error('Auth: erro ao atualizar dados do usuário', error);
        }
    };


    const login = async (credentials) => {
        setLoading(true);
        try {
            const response = await loginService(credentials);
            const userData = response.user;

            const isIncomplete = userData.usuario === null;

            if (userData.primeiro_acesso || isIncomplete) {
                setMostrarModalPrimeiroAcesso(true);
                InMemoryStorage.setItem('mostrarModalPrimeiroAcesso', 'true');
            }

            setUser({ isAuthenticated: true, ...userData });
            sessionStorage.setItem('user', JSON.stringify(userData));
            return response;
        } catch (error) {
            console.error('Auth: Erro ao fazer login:', error);
            setUser(null);
            sessionStorage.removeItem('user');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const logout = async () => {
        setLoading(true);
        try {
            if (!expired) {
                await logoutService();
            }
        } catch (e) {
            console.error('Auth: Erro ao fazer logout:', e);
        } finally {
            setUser(null);
            setMostrarModalPrimeiroAcesso(false);
            sessionStorage.removeItem('user');
            InMemoryStorage.removeItem('mostrarModalPrimeiroAcesso');
            InMemoryStorage.removeItem('habilidades_cache');
            navigate('/login');
            setLoading(false);
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, mostrarModalPrimeiroAcesso, setMostrarModalPrimeiroAcesso, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);