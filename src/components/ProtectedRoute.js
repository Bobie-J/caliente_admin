import React from 'react';
import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import NavigationBar from './NavigationBar';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute() {
  const { adminUser, logout } = useAuth();
  const navigate = useNavigate();

  // 未ログインなら問答無用でログイン画面へ
  if (!adminUser) {
    return <Navigate to="/login" replace />;
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
      {/* 共通のサイドメニュー */}
      <NavigationBar />

      {/* メインエリア */}
      <div style={{ flex: 1, marginLeft: '240px', display: 'flex', flexDirection: 'column' }}>
        {/* ヘッダー */}
        <header style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '15px 30px', background: '#fff', borderBottom: '1px solid #ddd', height: '60px', boxSizing: 'border-box' }}>
          <span style={{ marginRight: '20px' }}>ログイン中: <strong>{adminUser?.name}</strong></span>
          <button onClick={handleLogout} style={{ padding: '6px 12px', background: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            ログアウト
          </button>
        </header>

        {/* 各ページがここにスッポリ嵌まる */}
        <main style={{ flex: 1, padding: '30px' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}