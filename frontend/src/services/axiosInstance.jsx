// src/services/axiosInstance.jsx
import axios from 'axios';
import { refreshToken } from './Api.jsx';
import { updateUser } from './userManager';

let logoutFunc = null;
let setExpiredFunc = null;

export const registerSessionHandlers = (logout, setExpired) => {
    logoutFunc = logout;
    setExpiredFunc = setExpired;
};

const axiosInstance = axios.create({
    baseURL: '/conn/',
    withCredentials: true,
});

// ────────────────────────────────────────────────────────────────────────────────
// Controle de fila enquanto um refresh está em andamento
// ────────────────────────────────────────────────────────────────────────────────
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error) => {
    failedQueue.forEach(({ resolve, reject, config }) => {
        error ? reject(error) : resolve(axiosInstance(config));
    });
    failedQueue = [];
};

// ────────────────────────────────────────────────────────────────────────────────
// Interceptor de respostas
// ────────────────────────────────────────────────────────────────────────────────
axiosInstance.interceptors.response.use(
    (res) => res,
    async (err) => {
        const { status } = err.response || {};
        const originalReq = err.config;

        if (originalReq.url.includes('auth/api/token/refresh')) {
            return Promise.reject(err);
        }

        if (status !== 401 || originalReq._retry) {
            return Promise.reject(err);
        }

        if (isRefreshing) {
            return new Promise((resolve, reject) => {
                failedQueue.push({ resolve, reject, config: { ...originalReq, _retry: true } });
            });
        }

        originalReq._retry = true;
        isRefreshing = true;

        try {
            await refreshToken();
            updateUser?.();
            processQueue(null);
            return axiosInstance(originalReq);
        } catch (refreshErr) {
            processQueue(refreshErr);

            // ⚠️ Sinaliza sessão expirada e evita qualquer nova requisição
            if (setExpiredFunc && logoutFunc) {
                setExpiredFunc(true); // exibe modal
                logoutFunc();         // realiza logout
            }

            return Promise.reject(refreshErr);
        } finally {
            isRefreshing = false;
        }
    }
);

export default axiosInstance;
