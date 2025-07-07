import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEmailStore } from '../stores/emailStore';
import { useTheme } from '../hooks/useKeyboardShortcuts';
import { 
  InboxIcon,
  PaperAirplaneIcon,
  DocumentDuplicateIcon,
  TrashIcon,
  StarIcon,
  ArchiveBoxIcon,
  ExclamationTriangleIcon,
  FolderIcon,
  PlusIcon,
  Cog6ToothIcon,
  SunIcon,
  MoonIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline';
import {
  InboxIcon as InboxIconSolid,
  PaperAirplaneIcon as PaperAirplaneIconSolid,
  DocumentDuplicateIcon as DocumentDuplicateIconSolid,
  TrashIcon as TrashIconSolid,
  StarIcon as StarIconSolid,
  ArchiveBoxIcon as ArchiveBoxIconSolid,
  ExclamationTriangleIcon as ExclamationTriangleIconSolid
} from '@heroicons/react/24/solid';
import { EmailFolder, EmailLabel } from '../types/email';
import clsx from 'clsx';

interface SidebarProps {
  className?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ className }) => {
  const {
    folders,
    labels,
    currentFolder,
    setCurrentFolder,
    account,
    getUnreadCount,
    setComposeOpen,
    resetEmailConfig
  } = useEmailStore();
  
  const { theme, toggleTheme } = useTheme();
  const [isLabelsExpanded, setIsLabelsExpanded] = useState(true);
  const [isFoldersExpanded, setIsFoldersExpanded] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const defaultFolders = [
    {
      id: 'inbox',
      name: 'Inbox',
      path: 'INBOX',
      type: 'inbox' as const,
      icon: InboxIcon,
      iconSolid: InboxIconSolid,
      unreadCount: getUnreadCount(),
      totalCount: 0
    },
    {
      id: 'starred',
      name: 'Starred',
      path: 'starred',
      type: 'custom' as const,
      icon: StarIcon,
      iconSolid: StarIconSolid,
      unreadCount: 0,
      totalCount: 0
    },
    {
      id: 'sent',
      name: 'Sent',
      path: 'SENT',
      type: 'sent' as const,
      icon: PaperAirplaneIcon,
      iconSolid: PaperAirplaneIconSolid,
      unreadCount: 0,
      totalCount: 0
    },
    {
      id: 'drafts',
      name: 'Drafts',
      path: 'DRAFTS',
      type: 'drafts' as const,
      icon: DocumentDuplicateIcon,
      iconSolid: DocumentDuplicateIconSolid,
      unreadCount: 0,
      totalCount: 0
    },
    {
      id: 'archive',
      name: 'Archive',
      path: 'archive',
      type: 'custom' as const,
      icon: ArchiveBoxIcon,
      iconSolid: ArchiveBoxIconSolid,
      unreadCount: 0,
      totalCount: 0
    },
    {
      id: 'spam',
      name: 'Spam',
      path: 'SPAM',
      type: 'spam' as const,
      icon: ExclamationTriangleIcon,
      iconSolid: ExclamationTriangleIconSolid,
      unreadCount: 0,
      totalCount: 0
    },
    {
      id: 'trash',
      name: 'Trash',
      path: 'TRASH',
      type: 'trash' as const,
      icon: TrashIcon,
      iconSolid: TrashIconSolid,
      unreadCount: 0,
      totalCount: 0
    }
  ];

  const FolderItem: React.FC<{ folder: EmailFolder | typeof defaultFolders[0]; isActive: boolean }> = ({ folder, isActive }) => {
    const Icon = isActive && 'iconSolid' in folder ? folder.iconSolid : ('icon' in folder ? folder.icon : FolderIcon);
    
    return (
      <motion.div
        whileHover={{ backgroundColor: theme === 'dark' ? '#374151' : '#f1f5f9' }}
        whileTap={{ scale: 0.98 }}
        className={clsx(
          'flex items-center px-3 py-2 mx-2 rounded-lg cursor-pointer transition-all duration-200 relative',
          isActive
            ? 'bg-[#1a73e8] text-white font-semibold'
            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
        )}
        onClick={() => setCurrentFolder(folder.path)}
      >
        <Icon className="h-5 w-5 mr-3 flex-shrink-0" />
        <span className="flex-1 text-sm font-medium truncate">
          {folder.name}
        </span>
        {folder.unreadCount > 0 && (
          <span className="ml-2 bg-white text-[#1a73e8] text-xs rounded-full px-2 py-0.5 min-w-[1.25rem] text-center font-bold border border-[#1a73e8]">
            {folder.unreadCount > 99 ? '99+' : folder.unreadCount}
          </span>
        )}
      </motion.div>
    );
  };

  const LabelItem: React.FC<{ label: EmailLabel }> = ({ label }) => {
    return (
      <motion.div
        whileHover={{ backgroundColor: theme === 'dark' ? '#374151' : '#f1f5f9' }}
        className="flex items-center px-3 py-1.5 mx-2 rounded-lg cursor-pointer transition-all duration-200"
      >
        <div 
          className="h-3 w-3 rounded-full mr-3 flex-shrink-0"
          style={{ backgroundColor: label.color }}
        />
        <span className="flex-1 text-sm text-slate-700 dark:text-slate-300 truncate">
          {label.name}
        </span>
        {label.count > 0 && (
          <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
            {label.count}
          </span>
        )}
      </motion.div>
    );
  };

  return (
    <div
      className={clsx(
        'w-64 h-full bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col shadow-sm',
        className
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center mb-4 pl-1 select-none">
          <img src="/QHTn-2252146525.gif" alt="Inboxly Logo" className="h-8 w-8 rounded-full mr-2 object-cover" />
          <h1 className="text-2xl font-bold tracking-tight text-[#1a73e8] dark:text-[#8ab4f8]">Inboxly</h1>
        </div>
        <button
          onClick={() => setComposeOpen(true)}
          className="w-full flex items-center justify-start bg-[#1a73e8] hover:bg-[#1765c1] text-white font-medium py-2 px-4 rounded-full shadow transition-colors duration-150 mb-6"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Compose
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto">
        {/* Default Folders */}
        <div className="py-2">
          <div className="px-4 mb-2">
            <button
              onClick={() => setIsFoldersExpanded(!isFoldersExpanded)}
              className="flex items-center text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              {isFoldersExpanded ? (
                <ChevronDownIcon className="h-3 w-3 mr-1" />
              ) : (
                <ChevronRightIcon className="h-3 w-3 mr-1" />
              )}
              Folders
            </button>
          </div>
          
          <AnimatePresence>
            {isFoldersExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {defaultFolders.map((folder) => (
                  <FolderItem
                    key={folder.id}
                    folder={folder}
                    isActive={currentFolder === folder.path}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Custom Folders */}
        {folders.length > 0 && (
          <div className="py-2 border-t border-slate-200 dark:border-slate-700">
            <div className="px-4 mb-2">
              <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Custom Folders
              </h3>
            </div>
            {folders.map((folder) => (
              <FolderItem
                key={folder.path}
                folder={folder}
                isActive={currentFolder === folder.path}
              />
            ))}
          </div>
        )}

        {/* Labels */}
        {labels.length > 0 && (
          <div className="py-2 border-t border-slate-200 dark:border-slate-700">
            <div className="px-4 mb-2">
              <button
                onClick={() => setIsLabelsExpanded(!isLabelsExpanded)}
                className="flex items-center text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
              >
                {isLabelsExpanded ? (
                  <ChevronDownIcon className="h-3 w-3 mr-1" />
                ) : (
                  <ChevronRightIcon className="h-3 w-3 mr-1" />
                )}
                Labels
              </button>
            </div>
            
            <AnimatePresence>
              {isLabelsExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {labels.map((label) => (
                    <LabelItem key={label.id} label={label} />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex flex-col gap-2">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center justify-start px-3 py-2 text-sm rounded-lg transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 mb-1"
          title="Toggle dark/light mode"
        >
          {theme === 'dark' ? <SunIcon className="h-5 w-5 mr-2 text-[#1a73e8]" /> : <MoonIcon className="h-5 w-5 mr-2 text-[#1a73e8]" />}
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </button>
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="w-full flex items-center justify-start px-3 py-2 text-sm rounded-lg transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
          title="Settings"
        >
          <Cog6ToothIcon className="h-5 w-5 mr-2 text-[#1a73e8]" />
          Settings
        </button>
        <button
          onClick={() => {
            resetEmailConfig();
            window.location.href = '/';
          }}
          className="w-full flex items-center justify-start px-3 py-2 text-sm rounded-lg transition-colors hover:bg-red-100 dark:hover:bg-red-900/20"
          title="Logout"
        >
          <ArrowRightOnRectangleIcon className="h-5 w-5 mr-2 text-red-600 dark:text-red-400" />
          Logout
        </button>
      </div>
    </div>
  );
};

export default Sidebar;

