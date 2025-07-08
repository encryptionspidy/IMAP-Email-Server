import React from 'react';
import Sidebar from './Sidebar';
import EmailList from './EmailList';
import EmailDetail from './EmailDetail';
import ComposeModal from './ComposeModal';
import SettingsPanel from './SettingsPanel';
import { useEmailStore } from '../stores/emailStore';
import { useWebSocket } from '../hooks/useKeyboardShortcuts';
import { getApiUrl } from '../config/api';
// Removed unused imports

const EmailClient: React.FC = () => {
  const {
    currentEmail,
    currentFolder,
    isComposeOpen,
    setComposeOpen,
    setEmails,
    setLoading,
    isLoading,
    isSidebarOpen,
    setSidebarOpen
  } = useEmailStore();
  const { connectWebSocket, disconnectWebSocket } = useWebSocket();

  const [error, setError] = React.useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);

  React.useEffect(() => {
    // Connect WebSocket on mount
    connectWebSocket();
    // Disconnect WebSocket on unmount
    return () => {
      disconnectWebSocket();
    };
  }, [connectWebSocket, disconnectWebSocket]);

  // Create a function to fetch emails for a specific folder
  const fetchEmailsForFolder = React.useCallback(async (folder: string) => {
    setLoading(true);
    setError(null);
    try {
      // Get stored configuration
      const storedConfig = sessionStorage.getItem('imapConfig');
      if (!storedConfig) {
        setError('No email configuration found. Please connect to your email server.');
        return;
      }
      
      const config = JSON.parse(storedConfig);
      
      console.log('📧 Making API request to /emails/list with config:', {
        host: config.host,
        username: config.username,
        folder: folder,
        limit: 50
      });
      
      const response = await fetch(getApiUrl('/emails/list'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...config,
          folder: folder,
          limit: 50
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch emails');
      }
      const data = await response.json();
      console.log('📨 API Response:', {
        success: data.success,
        emailCount: data.emails?.length || 0,
        total: data.total,
        hasMore: data.hasMore,
        error: data.error,
        folder: folder
      });
      
      if (data.success && data.emails) {
        // Transform dates from strings to Date objects
        const emailsWithDates = data.emails.map((email: any) => ({
          ...email,
          date: new Date(email.date)
        }));
        setEmails(emailsWithDates);
        console.log(`✅ Emails loaded successfully for ${folder}:`, emailsWithDates.length);
      } else {
        console.error('❌ API response error:', data.error);
        setError(data.error || `Failed to load emails from ${folder}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to load emails from ${folder}`);
    } finally {
      setLoading(false);
    }
  }, [setEmails, setLoading]);

  // Fetch emails on mount
  React.useEffect(() => {
    fetchEmailsForFolder(currentFolder);
  }, []);

  // Listen for folder changes and refetch emails
  React.useEffect(() => {
    console.log('📁 Folder changed to:', currentFolder);
    fetchEmailsForFolder(currentFolder);
  }, [currentFolder, fetchEmailsForFolder]);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen bg-white dark:bg-gray-900">
        <div className="flex flex-col items-center justify-center">
          <div className="w-12 h-12 mb-4 relative">
            <span className="absolute inline-block w-full h-full rounded-full border-4 border-blue-400 border-t-transparent animate-spin"></span>
          </div>
          <p className="text-lg text-gray-700 dark:text-gray-200 font-medium">Connecting to your inbox...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-2">{error}</p>
          <button
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={() => window.location.href = '/'}
          >
            Reconnect
          </button>
        </div>
      </div>
    );
  }

return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setSidebarOpen(!isSidebarOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          {/* No app name or Compose button here, just spacing */}
        </div>
        {/* Remove the right section entirely */}
      </div>
      
      {/* Three-Panel Layout */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && (
          <div 
            className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        
        {/* Left Panel - Sidebar */}
        <div className={`
          absolute md:relative z-50 md:z-auto 
          w-64 h-full flex-shrink-0 
          transform transition-transform duration-300 ease-in-out
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
          <Sidebar className="h-full" />
        </div>
        
        {/* Middle Panel - Email List */}
        <div className={`
          ${currentEmail ? 'w-full md:w-96' : 'w-full'} 
          flex-shrink-0 min-w-0 transition-all duration-300
        `}>
          <EmailList className="h-full" />
        </div>
        
        {/* Right Panel - Email Detail - Only show when email is selected */}
        {currentEmail && (
          <div className="flex-1 min-w-0 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700">
            <EmailDetail />
          </div>
        )}
      </div>

      {isComposeOpen && <ComposeModal onClose={() => setComposeOpen(false)} />}
      <SettingsPanel isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
};

export default EmailClient;

