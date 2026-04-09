import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ContributorDashboard from './pages/ContributorDashboard';
import ChangePassword from './pages/ChangePassword';

// Simple check if token exists in sessionStorage
const isAuthenticated = () => {
  return !!sessionStorage.getItem('token');
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const HomeByRole = () => {
  const role = sessionStorage.getItem('role');
  return role === 'admin' ? <Navigate to="/dashboard" replace /> : <Navigate to="/contributor" replace />;
};

function App() {
  return (
    <>
      <div className="pulse-bg">
        <div className="pulse-blob blob-1" style={{ background: 'rgba(16, 185, 129, 0.15)' }}></div>
        <div className="pulse-blob blob-2" style={{ background: 'rgba(34, 197, 94, 0.1)' }}></div>
      </div>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
          <Route path="/home" element={<ProtectedRoute><HomeByRole /></ProtectedRoute>} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/contributor"
            element={
              <ProtectedRoute>
                <ContributorDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
