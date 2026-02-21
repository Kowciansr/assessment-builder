import React from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import BuilderPage from './pages/BuilderPage';
import BankPage from './pages/BankPage';

const NAV = [
  { to: '/', label: 'Builder', icon: '⚡' },
  { to: '/bank', label: 'Question Bank', icon: '🗃' },
];

export default function App() {
  const location = useLocation();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Toaster position="top-right" toastOptions={{ duration: 3000 }} />

      {/* Topbar */}
      <header style={{
        background: 'white',
        borderBottom: '1px solid var(--gray-200)',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        height: 56,
        gap: 32,
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>📐</span>
          <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--gray-900)' }}>Assessment Builder</span>
          <span style={{
            fontSize: 10, fontWeight: 600, background: 'var(--primary-light)', color: 'var(--primary)',
            padding: '2px 6px', borderRadius: 999, marginLeft: 4,
          }}>INTERNAL</span>
        </div>

        <nav style={{ display: 'flex', gap: 4 }}>
          {NAV.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 'var(--radius)',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--primary)' : 'var(--gray-600)',
                background: isActive ? 'var(--primary-light)' : 'transparent',
                textDecoration: 'none', fontSize: 14,
                transition: 'all 0.15s',
              })}
            >
              <span>{icon}</span> {label}
            </NavLink>
          ))}
        </nav>
      </header>

      {/* Main content */}
      <main style={{ flex: 1, padding: '24px', maxWidth: 1400, margin: '0 auto', width: '100%' }}>
        <Routes>
          <Route path="/" element={<BuilderPage />} />
          <Route path="/bank" element={<BankPage />} />
        </Routes>
      </main>
    </div>
  );
}
