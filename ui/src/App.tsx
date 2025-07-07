import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useEmailStore } from './stores/emailStore';
import { useKeyboardShortcuts, useTheme } from './hooks/useKeyboardShortcuts';
import EmailClient from './components/EmailClient';
import ConnectionForm from './components/ConnectionForm';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

// Utility function to check if user has valid email configuration
function hasValidEmailConfig(): boolean {
  try {
    const storedConfig = sessionStorage.getItem('imapConfig');
    if (!storedConfig) return false;
    
    const config = JSON.parse(storedConfig);
    return !!(config.host && config.username && config.password);
  } catch {
    return false;
  }
}

function App() {
  const { account } = useEmailStore();
  const { theme } = useTheme();
  
  // Initialize keyboard shortcuts
  useKeyboardShortcuts();

  // Check if user is connected (both account state and sessionStorage)
  const isConnected = account?.isConnected && hasValidEmailConfig();

  return (
    <ErrorBoundary>
      <div className={`min-h-screen transition-colors duration-300 ${
        theme === 'dark' ? 'dark bg-slate-900' : 'bg-slate-50'
      }`}>
        <Routes>
          <Route 
            path="/" 
            element={
              isConnected ? 
                <Navigate to="/inbox" replace /> : 
                <ConnectionForm />
            } 
          />
          <Route 
            path="/connect" 
            element={<ConnectionForm />} 
          />
          <Route 
            path="/email" 
            element={
              isConnected ? 
                <Navigate to="/inbox" replace /> : 
                <ConnectionForm />
            } 
          />
          <Route 
            path="/inbox" 
            element={
              isConnected ? 
                <EmailClient /> : 
                <Navigate to="/connect" replace />
            } 
          />
          <Route 
            path="/emails" 
            element={
              isConnected ? 
                <EmailClient /> : 
                <Navigate to="/connect" replace />
            } 
          />
          <Route 
            path="/*" 
            element={
              isConnected ? 
                <Navigate to="/inbox" replace /> : 
                <Navigate to="/connect" replace />
            } 
          />
        </Routes>
        
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            className: theme === 'dark' ? 'dark-toast' : '',
            style: {
              background: theme === 'dark' ? '#374151' : '#ffffff',
              color: theme === 'dark' ? '#f9fafb' : '#111827',
              border: theme === 'dark' ? '1px solid #4b5563' : '1px solid #e5e7eb',
              borderRadius: '12px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            },
          }}
        />
      </div>
    </ErrorBoundary>
  );
}

export default App;
