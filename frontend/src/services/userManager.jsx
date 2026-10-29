// frontend/src/services/userManager.jsx
import { buscarDadosUsuario } from './Api.jsx'; // ajuste o caminho se necessário

let setUserCallback = null;

export const setUserHandler = (callback) => {
    setUserCallback = callback;
};

export const updateUser = async () => {
    if (!setUserCallback) return;

    try {
        const data = await buscarDadosUsuario();

        const userData = { isAuthenticated: true, ...data };

        setUserCallback(userData);
        sessionStorage.setItem('user', JSON.stringify(userData));
    } catch (error) {
        console.error('Falha ao atualizar usuário:', error);
        setUserCallback(null);
        sessionStorage.removeItem('user');
    }
};
