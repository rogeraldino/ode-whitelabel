// src/App.jsx
import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';

import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import GerarAtividadesPage from "./pages/GerarAtividadesPage";
import PerfilPage from './pages/PerfilPage';
import EditorQuestoes from './pages/EditorQuestoes';
import PlanoDeAulaGerador from './pages/PlanoDeAulaGerador';
import MapaMental from './pages/MapaMental';
import Resumo from './pages/Resumo';
import AdminUsuariosPage from './pages/AdminUsuariosPage';

import CorrigirAtividade from './pages/CorrigirAtividade';
import TestHeaderPage from './pages/TestHeaderPage';

import PrivateRoute from './components/PrivateRoute';
import Layout from './components/Layout';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { SessionExpiredProvider, useSessionExpired } from './hooks/useSessionExpired';
import SessionExpiredModal from './components/modals/SessionExpiredModal';
import { registerSessionHandlers } from './services/axiosInstance';

const NavigationSetter = () => {
  const navigate = useNavigate();

  useEffect(() => {
    console.log('App.jsx: setNavigateFunction chamado com a função navigate.');
  }, [navigate]);

  return null;
};

const SessionHandlerConnector = () => {
  const { logout } = useAuth();
  const { setExpired } = useSessionExpired();

  useEffect(() => {
    registerSessionHandlers(logout, setExpired);
  }, [logout, setExpired]);

  return null;
};

// Componente global para rolar para o topo ao mudar de rota
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
      <BrowserRouter>
        <ScrollToTop />
        <SessionExpiredProvider>
          <AuthProvider>
            <SessionHandlerConnector />
            <NavigationSetter />

            <Routes>
              <Route path="/login" element={<LoginPage />} />

              <Route element={<PrivateRoute />}>
                <Route element={<Layout />}>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/perfil" element={<PerfilPage />} />
                  <Route path="/gerar-atividades" element={<GerarAtividadesPage />} />
                  <Route path="/editor-lista" element={<EditorQuestoes />} />
                  <Route path="/editar-lista/:uuid" element={<EditorQuestoes />} />
                  <Route path="/plano-de-aula-gerador" element={<PlanoDeAulaGerador />} />
                  <Route path="/mapa-mental" element={<MapaMental />} />
                  <Route path="/resumo" element={<Resumo />} />
                  <Route path="/admin/usuarios" element={<AdminUsuariosPage />} />

                  <Route path="/corrigir-atividade" element={<CorrigirAtividade />} />
                  <Route path="/test-header" element={<TestHeaderPage />} />
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/login" />} />
            </Routes>

            <SessionExpiredModal />
          </AuthProvider>
        </SessionExpiredProvider>
      </BrowserRouter>
  );
}
