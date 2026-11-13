import React from 'react';
import { Outlet } from 'react-router-dom';
import NavigationBar from '../components/NavigationBar';

const AdminLayout = () => {
  return (
    <div style={{ display: 'flex' }}>
      <NavigationBar />
      <main style={{ marginLeft: '240px', padding: '30px', width: 'calc(100% - 240px)' }}>
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
