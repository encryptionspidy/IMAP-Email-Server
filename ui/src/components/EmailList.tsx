import React, { useState, useCallback, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEmailStore } from '../stores/emailStore';
import { Email } from '../types/email';
import { 
  formatEmailDate, 
  getEmailPreview, 
  getEmailInitials, 
  getEmailColor,
} from '../utils/emailUtils';
import {
  StarIcon,
  PaperClipIcon,
  AdjustmentsHorizontalIcon,
  ViewColumnsIcon,
  ListBulletIcon,
  Squares2X2Icon,
  ChevronDownIcon,
  ChevronUpIcon,
  InboxIcon,
} from '@heroicons/react/24/outline';
import {
  StarIcon as StarIconSolid,
} from '@heroicons/react/24/solid';
import clsx from 'clsx';
import EmailSearchBar from './EmailSearchBar';
import EmailFilters from './EmailFilters';
import { EmailListSkeleton } from './LoadingSkeleton';

interface EmailListProps {
  className?: string;
}

// Memoized Email Item Component to prevent unnecessary re-renders
const EmailItem = memo<{ email: Email; index: number; isSelected: boolean; isActive: boolean; onSelect: (emailId: string) => void; onStar: (emailId: string) => void; onCheckboxChange: (emailId: string) => void }>(
  ({ email, index, isSelected, isActive, onSelect, onStar, onCheckboxChange }) => {
    const [isHovered, setIsHovered] = useState(false);

    const handleClick = useCallback((e: React.MouseEvent) => {
      e.preventDefault();
      onSelect(email.id);
    }, [email.id, onSelect]);

    const handleStarClick = useCallback((e: React.MouseEvent) => {
      e.stopPropagation();
      onStar(email.id);
    }, [email.id, onStar]);

    const handleCheckboxChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      e.stopPropagation();
      onCheckboxChange(email.id);
    }, [email.id, onCheckboxChange]);

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.02, duration: 0.2 }}
        className={clsx(
          'email-item flex items-center px-4 py-3 border-b border-slate-200 dark:border-slate-700 cursor-pointer',
          isActive && 'bg-blue-100 dark:bg-blue-900/40',
          isSelected && 'bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-200 dark:ring-blue-800',
          !email.isRead && 'font-semibold'
        )}
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={handleCheckboxChange}
          className="mr-3 h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
        />
        
        <button
          onClick={handleStarClick}
          className="mr-3 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
        >
          {email.isStarred ? (
            <StarIconSolid className="h-4 w-4 text-yellow-400" />
          ) : (
            <StarIcon className="h-4 w-4 text-slate-400 hover:text-yellow-400" />
          )}
        </button>

        <div className="flex-1 min-w-0 grid grid-cols-12 gap-2 items-center">
          <div className="col-span-3 truncate">
            <span className={clsx(
              'text-sm',
              !email.isRead ? 'font-semibold text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300'
            )}>
              {email.from.name || email.from.address}
            </span>
          </div>
          
          <div className="col-span-6 truncate">
            <span className={clsx(
              'text-sm',
              !email.isRead ? 'font-medium text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300'
            )}>
              {email.subject}
            </span>
            <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">
              — {getEmailPreview(email, 50)}
            </span>
          </div>
          
          <div className="col-span-2 flex items-center justify-end space-x-2">
            {email.hasAttachments && (
              <PaperClipIcon className="h-4 w-4 text-slate-400" />
            )}
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {formatEmailDate(email.date)}
            </span>
          </div>
        </div>
      </motion.div>
    );
  }
);

EmailItem.displayName = 'EmailItem';

const EmailList: React.FC<EmailListProps> = ({ className }) => {
  const {
    currentEmail,
    selectedEmails,
    isLoading,
    viewMode,
    sortBy,
    sortOrder,
    searchQuery,
    currentFolder,
    setCurrentEmail,
    toggleEmailSelection,
    selectAllEmails,
    clearSelection,
    setViewMode,
    setSorting,
    markAsRead,
    markAsUnread,
    toggleStar,
    archiveEmails,
    deleteEmails,
    getFilteredEmails
  } = useEmailStore();

  const [showFilters, setShowFilters] = useState(false);

  const filteredEmails = useMemo(() => getFilteredEmails(), [getFilteredEmails]);
  const allSelected = selectedEmails.length === filteredEmails.length && filteredEmails.length > 0;
  const someSelected = selectedEmails.length > 0 && selectedEmails.length < filteredEmails.length;

  const handleSelectAll = useCallback(() => {
    if (allSelected) {
      clearSelection();
    } else {
      selectAllEmails();
    }
  }, [allSelected, clearSelection, selectAllEmails]);

  const handleBulkAction = useCallback((action: string) => {
    switch (action) {
      case 'markRead':
        markAsRead(selectedEmails);
        break;
      case 'markUnread':
        markAsUnread(selectedEmails);
        break;
      case 'star':
        toggleStar(selectedEmails);
        break;
      case 'archive':
        archiveEmails(selectedEmails);
        break;
      case 'delete':
        deleteEmails(selectedEmails);
        break;
    }
    clearSelection();
  }, [selectedEmails, markAsRead, markAsUnread, toggleStar, archiveEmails, deleteEmails, clearSelection]);

  const handleSort = useCallback((field: 'date' | 'subject' | 'from' | 'size') => {
    const newOrder = sortBy === field && sortOrder === 'desc' ? 'asc' : 'desc';
    setSorting(field, newOrder);
  }, [sortBy, sortOrder, setSorting]);

  const handleEmailSelect = useCallback((emailId: string) => {
    const email = filteredEmails.find(e => e.id === emailId);
    if (email) {
      setCurrentEmail(email);
      if (!email.isRead) {
        markAsRead([email.id]);
      }
    }
  }, [filteredEmails, setCurrentEmail, markAsRead]);

  const handleEmailStar = useCallback((emailId: string) => {
    toggleStar([emailId]);
  }, [toggleStar]);

  const handleEmailCheckbox = useCallback((emailId: string) => {
    toggleEmailSelection(emailId);
  }, [toggleEmailSelection]);

  return (
    <div className={clsx('flex flex-col h-full bg-white dark:bg-slate-800', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center space-x-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {currentFolder || 'Inbox'}
          </h2>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {filteredEmails.length} messages
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setViewMode(viewMode === 'compact' ? 'comfortable' : 'compact')}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            title={viewMode === 'compact' ? 'Switch to comfortable view' : 'Switch to compact view'}
          >
            {viewMode === 'compact' ? (
              <ViewColumnsIcon className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            ) : (
              <ListBulletIcon className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            )}
          </button>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            title="Show filters"
          >
            <AdjustmentsHorizontalIcon className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        <EmailSearchBar />
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <EmailFilters />
        </div>
      )}

      {/* Toolbar */}
      {someSelected && (
        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-slate-600 dark:text-slate-300">
              {selectedEmails.length} selected
            </span>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => handleBulkAction('markRead')}
              className="px-3 py-1 text-sm bg-slate-100 hover:bg-slate-200 dark:bg-slate-600 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200 rounded-md transition-colors"
            >
              Mark Read
            </button>
            <button
              onClick={() => handleBulkAction('star')}
              className="px-3 py-1 text-sm bg-slate-100 hover:bg-slate-200 dark:bg-slate-600 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200 rounded-md transition-colors"
            >
              Star
            </button>
            <button
              onClick={() => handleBulkAction('delete')}
              className="px-3 py-1 text-sm bg-red-100 hover:bg-red-200 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Email List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <EmailListSkeleton />
        ) : filteredEmails.length === 0 ? (
          <div className="p-8 text-center">
            <InboxIcon className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600 dark:text-slate-400">No emails found</p>
          </div>
        ) : (
          <div>
            {/* Select All Header */}
            <div className="flex items-center px-4 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(input) => {
                  if (input) input.indeterminate = someSelected && !allSelected;
                }}
                onChange={handleSelectAll}
                className="mr-3 h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Select All
              </span>
            </div>

            {/* Email Items */}
            <AnimatePresence>
              {filteredEmails.map((email, index) => (
                <EmailItem
                  key={email.id}
                  email={email}
                  index={index}
                  isSelected={selectedEmails.includes(email.id)}
                  isActive={currentEmail?.id === email.id}
                  onSelect={handleEmailSelect}
                  onStar={handleEmailStar}
                  onCheckboxChange={handleEmailCheckbox}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailList;
