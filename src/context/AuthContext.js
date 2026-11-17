import React, { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [adminUser, setAdminUser] = useState(() => {
    try {
      const saved = sessionStorage.getItem('caliente_admin_user');
      if (!saved || saved === '0' || saved === 'null' || saved === 'undefined') {
        return null;
      }
      const parsed = JSON.parse(saved);
      // 正しいオブジェクト構造（idを持っているか）を確認
      return (parsed && typeof parsed === 'object' && parsed.id) ? parsed : null;
    } catch (e) {
      return null;
    }
  });

  const login = (userData) => {
    setAdminUser(userData);
    sessionStorage.setItem('caliente_admin_user', JSON.stringify(userData));
  };

  const logout = () => {
    setAdminUser(null);
    sessionStorage.removeItem('caliente_admin_user');
  };

  return (
    <AuthContext.Provider value={{ adminUser, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}