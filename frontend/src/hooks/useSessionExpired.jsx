import { createContext, useContext, useState } from 'react';

const SessionExpiredContext = createContext();

export const SessionExpiredProvider = ({ children }) => {
    const [expired, setExpired] = useState(false);

    return (
        <SessionExpiredContext.Provider value={{ expired, setExpired }}>
            {children}
        </SessionExpiredContext.Provider>
    );
};

export const useSessionExpired = () => useContext(SessionExpiredContext);
