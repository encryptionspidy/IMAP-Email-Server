import React, { memo, useMemo, useCallback } from 'react';
import { FixedSizeList as List } from 'react-window';
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
} from '@heroicons/react/24/outline';
import {
  StarIcon as StarIconSolid,
} from '@heroicons/react/24/solid';
import clsx from 'clsx';

interface EmailItemProps {
  index: number;
  style: React.CSSProperties;
  data: {
    emails: Email[];
    selectedEmails: string[];
    currentEmailId: string | null;
    onSelect: (emailId: string) => void;
    onStar: (emailId: string) => void;
    onCheckboxChange: (emailId: string) => void;
  };
}

const EmailItem = memo<EmailItemProps>(({ index, style, data }) => {
  const { emails, selectedEmails, currentEmailId, onSelect, onStar, onCheckboxChange } = data;
  const email = emails[index];

  if (!email) return null;

  const isSelected = selectedEmails.includes(email.id);
  const isActive = currentEmailId === email.id;

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
    <div
      style={style}
      className={clsx(
        'email-item flex items-center px-4 py-3 border-b border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors',
        isActive && 'bg-blue-100 dark:bg-blue-900/40',
        isSelected && 'bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-200 dark:ring-blue-800',
        !email.isRead && 'font-semibold'
      )}
      onClick={handleClick}
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

      {/* Avatar */}
      <div className={clsx(
        'mr-3 h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-medium',
        getEmailColor(email.from)
      )}>
        {getEmailInitials(email.from)}
      </div>

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
    </div>
  );
});

EmailItem.displayName = 'EmailItem';

interface VirtualizedEmailListProps {
  className?: string;
  height?: number;
}

const VirtualizedEmailList: React.FC<VirtualizedEmailListProps> = ({ 
  className, 
  height = 600 
}) => {
  const {
    currentEmail,
    selectedEmails,
    toggleEmailSelection,
    setCurrentEmail,
    markAsRead,
    toggleStar,
    getFilteredEmails
  } = useEmailStore();

  const filteredEmails = useMemo(() => getFilteredEmails(), [getFilteredEmails]);

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

  const itemData = useMemo(() => ({
    emails: filteredEmails,
    selectedEmails,
    currentEmailId: currentEmail?.id || null,
    onSelect: handleEmailSelect,
    onStar: handleEmailStar,
    onCheckboxChange: handleEmailCheckbox,
  }), [
    filteredEmails, 
    selectedEmails, 
    currentEmail?.id, 
    handleEmailSelect, 
    handleEmailStar, 
    handleEmailCheckbox
  ]);

  if (filteredEmails.length === 0) {
    return (
      <div className={clsx('flex items-center justify-center h-full', className)}>
        <div className="text-center">
          <div className="h-16 w-16 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <PaperClipIcon className="h-8 w-8 text-slate-400" />
          </div>
          <p className="text-slate-600 dark:text-slate-400">No emails found</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <List
        height={height}
        itemCount={filteredEmails.length}
        itemSize={80} // Height of each email item
        itemData={itemData}
        width="100%"
      >
        {EmailItem}
      </List>
    </div>
  );
};

export default VirtualizedEmailList;
