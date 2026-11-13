import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AdminLayout from './layouts/AdminLayout';
import AdminTop from './pages/AdminTop';
import EventsPage from './pages/EventsPage';
import EventDetailPage from './pages/EventDetailPage';
import TeamsPage from './pages/TeamsPage';
import BillingPage from './pages/BillingPage';
import InstructorsPage from './pages/InstructorsPage';
import EventOrderPage from './pages/EventOrderPage';
import CsvImportPage from './pages/CsvImportPage';
import SongsPage from './pages/SongsPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AdminLayout />}>
          <Route index element={<AdminTop />} />
          <Route path="events" element={<EventsPage />} />
          <Route path="events/:eventId" element={<EventDetailPage />} />
          <Route path="events/:eventId/order" element={<EventOrderPage />} />
          <Route path="teams" element={<TeamsPage />} />
          <Route path="billing" element={<BillingPage />} />
          <Route path="instructors" element={<InstructorsPage />} />
          <Route path="import" element={<CsvImportPage />} />
          <Route path="/songs" element={<SongsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;