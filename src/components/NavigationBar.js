import React from 'react';
import { NavLink } from 'react-router-dom';

const NavigationBar = () => {
  const menuItems = [
    { name: 'イベント一覧', path: '/events', icon: '📅' },
    { name: 'チーム一覧', path: '/teams', icon: '👥' },
    { name: '請求', path: '/billing', icon: '💳' },
    { name: '代表者一覧', path: '/instructors', icon: '🕺' },
    { name: '楽曲一覧', path: '/songs', icon: '🎵' },
  ];

  return (
    <nav style={styles.sidebar}>
      <div style={styles.sidebarHeader}>
        <h2 style={styles.headerTitle}>管理メニュー</h2>
      </div>
      <ul style={styles.sidebarMenu}>
        {menuItems.map((item) => (
          <li key={item.path}>
            <NavLink
              to={item.path}
              style={({ isActive }) => ({
                ...styles.menuLink,
                ...(isActive ? styles.activeLink : {})
              })}
            >
              <span style={styles.menuIcon}>{item.icon}</span>
              <span>{item.name}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
};

const styles = {
  sidebar: {
    width: '240px',
    height: '100vh',
    position: 'fixed',
    top: 0,
    left: 0,
    backgroundColor: '#1e293b',
    color: '#ffffff',
    padding: '20px 0',
    boxSizing: 'border-box'
  },
  sidebarHeader: {
    padding: '0 20px 20px',
    borderBottom: '1px solid #334155'
  },
  headerTitle: {
    fontSize: '1.2rem',
    margin: 0
  },
  sidebarMenu: {
    listStyle: 'none',
    padding: 0,
    margin: '20px 0 0'
  },
  menuLink: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 20px',
    color: '#94a3b8',
    textDecoration: 'none',
    transition: 'all 0.2s ease'
  },
  activeLink: {
    backgroundColor: '#2563eb',
    color: '#ffffff',
    fontWeight: 'bold'
  },
  menuIcon: {
    marginRight: '12px'
  }
};

export default NavigationBar;