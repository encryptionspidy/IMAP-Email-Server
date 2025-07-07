import { useEffect, useCallback } from 'react';
import { useEmailStore } from '../stores/emailStore';
import toast from 'react-hot-toast';

interface ShortcutConfig {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  description: string;
  action: () => void;
}

export const useKeyboardShortcuts = () => {
  const {
    selectedEmails,
    currentEmail,
    isComposeOpen,
    setComposeOpen,
    markAsRead,
    markAsUnread,
    toggleStar,
    archiveEmails,
    deleteEmails,
    clearSelection,
    selectAllEmails,
    setCurrentFolder,
  } = useEmailStore();

  const shortcuts: ShortcutConfig[] = [
    {
      key: 'c',
      description: 'Compose new email',
      action: () => {
        setComposeOpen(true);
        toast.success('Opening compose window');
      },
    },
    {
      key: 'r',
      description: 'Reply to current email',
      action: () => {
        if (currentEmail) {
          // TODO: Implement reply functionality
          toast.success('Opening reply');
        } else {
          toast.error('No email selected');
        }
      },
    },
    {
      key: 'a',
      description: 'Reply all to current email',
      action: () => {
        if (currentEmail) {
          // TODO: Implement reply all functionality
          toast.success('Opening reply all');
        } else {
          toast.error('No email selected');
        }
      },
    },
    {
      key: 'f',
      description: 'Forward current email',
      action: () => {
        if (currentEmail) {
          // TODO: Implement forward functionality
          toast.success('Opening forward');
        } else {
          toast.error('No email selected');
        }
      },
    },
    {
      key: 'e',
      description: 'Archive selected emails',
      action: () => {
        if (selectedEmails.length > 0) {
          archiveEmails(selectedEmails);
          clearSelection();
          toast.success(`Archived ${selectedEmails.length} email(s)`);
        } else if (currentEmail) {
          archiveEmails([currentEmail.id]);
          toast.success('Email archived');
        } else {
          toast.error('No emails selected');
        }
      },
    },
    {
      key: 'Delete',
      description: 'Delete selected emails',
      action: () => {
        if (selectedEmails.length > 0) {
          deleteEmails(selectedEmails);
          clearSelection();
          toast.success(`Deleted ${selectedEmails.length} email(s)`);
        } else if (currentEmail) {
          deleteEmails([currentEmail.id]);
          toast.success('Email deleted');
        } else {
          toast.error('No emails selected');
        }
      },
    },
    {
      key: 's',
      description: 'Star/unstar selected emails',
      action: () => {
        if (selectedEmails.length > 0) {
          toggleStar(selectedEmails);
          toast.success('Toggled star');
        } else if (currentEmail) {
          toggleStar([currentEmail.id]);
          toast.success('Toggled star');
        } else {
          toast.error('No emails selected');
        }
      },
    },
    {
      key: 'i',
      description: 'Mark as read',
      action: () => {
        if (selectedEmails.length > 0) {
          markAsRead(selectedEmails);
          toast.success('Marked as read');
        } else if (currentEmail) {
          markAsRead([currentEmail.id]);
          toast.success('Marked as read');
        } else {
          toast.error('No emails selected');
        }
      },
    },
    {
      key: 'u',
      description: 'Mark as unread',
      action: () => {
        if (selectedEmails.length > 0) {
          markAsUnread(selectedEmails);
          toast.success('Marked as unread');
        } else if (currentEmail) {
          markAsUnread([currentEmail.id]);
          toast.success('Marked as unread');
        } else {
          toast.error('No emails selected');
        }
      },
    },
    {
      key: 'a',
      ctrlKey: true,
      description: 'Select all emails',
      action: () => {
        selectAllEmails();
        toast.success('Selected all emails');
      },
    },
    {
      key: 'Escape',
      description: 'Clear selection or close compose',
      action: () => {
        if (isComposeOpen) {
          setComposeOpen(false);
        } else if (selectedEmails.length > 0) {
          clearSelection();
          toast.success('Selection cleared');
        }
      },
    },
    {
      key: '/',
      description: 'Focus search',
      action: () => {
        const searchInput = document.querySelector('input[type="search"]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      },
    },
    {
      key: 'g',
      description: 'Go to inbox',
      action: () => {
        setCurrentFolder('INBOX');
        toast.success('Switched to inbox');
      },
    },
    {
      key: 'Enter',
      description: 'Open selected email',
      action: () => {
        if (selectedEmails.length === 1) {
          // TODO: Navigate to email detail
          toast.success('Opening email');
        }
      },
    },
  ];

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't trigger shortcuts if user is typing in an input or textarea
    const target = event.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.contentEditable === 'true' ||
      target.isContentEditable
    ) {
      // Allow Escape and Ctrl+A in inputs
      if (event.key !== 'Escape' && !(event.key === 'a' && event.ctrlKey)) {
        return;
      }
    }

    const shortcut = shortcuts.find(s => {
      return (
        s.key === event.key &&
        !!s.ctrlKey === event.ctrlKey &&
        !!s.altKey === event.altKey &&
        !!s.shiftKey === event.shiftKey &&
        !!s.metaKey === event.metaKey
      );
    });

    if (shortcut) {
      event.preventDefault();
      shortcut.action();
    }
  }, [shortcuts, selectedEmails, currentEmail, isComposeOpen]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return { shortcuts };
};

export const useTheme = () => {
  const { settings, setSettings } = useEmailStore();

  const toggleTheme = useCallback(() => {
    const newTheme = settings.theme === 'light' ? 'dark' : 'light';
    setSettings({ theme: newTheme });
    localStorage.setItem('theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    toast.success(`Switched to ${newTheme} theme`);
  }, [settings.theme, setSettings]);

  const setTheme = useCallback((theme: 'light' | 'dark' | 'system') => {
    setSettings({ theme });
    localStorage.setItem('theme', theme);
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      if (systemTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } else if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [setSettings]);

  // Apply theme on mount from localStorage
  useEffect(() => {
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme === 'dark' || storedTheme === 'light') {
      setTheme(storedTheme as 'light' | 'dark');
    } else {
      setTheme(settings.theme);
    }
  }, []);

  return { theme: settings.theme, toggleTheme, setTheme };
};

export const useWebSocket = () => {
  // TODO: Implement WebSocket connection for real-time updates
  const connectWebSocket = useCallback(() => {
    // Implementation for WebSocket connection
  }, []);

  const disconnectWebSocket = useCallback(() => {
    // Implementation for WebSocket disconnection
  }, []);

  return { connectWebSocket, disconnectWebSocket };
};
