import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import AdminTop from './pages/AdminTop';
import EventsPage from './pages/EventsPage';
import EventDetailPage from './pages/EventDetailPage';
import TeamsPage from './pages/TeamsPage';
import BillingPage from './pages/BillingPage';
import InstructorsPage from './pages/InstructorsPage';
import EventOrderPage from './pages/EventOrderPage';
import CsvImportPage from './pages/CsvImportPage';
import SongsPage from './pages/SongsPage';
import AdminUsersPage from './pages/AdminUsersPage';
import MyPage from './pages/MyPage';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* ログイン必須＆共通レイアウト（ここでNavigationBarと認証を一括管理） */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<AdminTop />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/events/:eventId" element={<EventDetailPage />} />
            <Route path="/events/:eventId/order" element={<EventOrderPage />} />
            <Route path="/teams" element={<TeamsPage />} />
            <Route path="/billing" element={<BillingPage />} />
            <Route path="/instructors" element={<InstructorsPage />} />
            <Route path="/import" element={<CsvImportPage />} />
            <Route path="/songs" element={<SongsPage />} />
            <Route path="/admin-users" element={<AdminUsersPage />} />
            <Route path="/mypage" element={<MyPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;