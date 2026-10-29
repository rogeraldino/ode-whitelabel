// Exemplo de como pode ser seu PrivateRoute.jsx
// Por favor, me envie o real.
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const PrivateRoute = () => {
    const { user, loading } = useAuth();
    console.log('PrivateRoute: Renderizando. User:', user, 'Loading:', loading);

    if (loading) {
        console.log('PrivateRoute: Ainda carregando autenticação...');
        return <div>Carregando...</div>; // Ou um spinner, etc.
    }

    if (!user || !user.isAuthenticated) {
        console.log('PrivateRoute: Usuário não autenticado. Redirecionando para /login');
        return <Navigate to="/login" replace />;
    }

    console.log('PrivateRoute: Usuário autenticado. Renderizando Outlet.');
    return <Outlet />;
};

export default PrivateRoute;