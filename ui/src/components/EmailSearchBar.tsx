import React, { useCallback, useState, useEffect } from 'react';
import { useEmailStore } from '../stores/emailStore';
import {
  MagnifyingGlassIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { debounce } from '../utils/emailUtils';
import clsx from 'clsx';

const EmailSearchBar: React.FC = () => {
  const { searchQuery, setSearchQuery, clearFilter, setSearching } = useEmailStore();
  const [localQuery, setLocalQuery] = useState(searchQuery);

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce((query: string) => {
      setSearchQuery(query);
      setSearching(false);
    }, 300),
    [setSearchQuery, setSearching]
  );

  // Effect to handle debounced searching
  useEffect(() => {
    if (localQuery !== searchQuery) {
      setSearching(true);
      debouncedSearch(localQuery);
    }
  }, [localQuery, searchQuery, debouncedSearch, setSearching]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalQuery(e.target.value);
  }, []);

  const handleClear = useCallback(() => {
    setLocalQuery('');
    setSearchQuery('');
    clearFilter();
    setSearching(false);
  }, [setSearchQuery, clearFilter, setSearching]);

  return (
    <div className="relative">
      <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
      <input
        type="search"
        value={localQuery}
        onChange={handleInputChange}
        placeholder="Search emails... Try 'from:john', 'has:attachment', 'is:unread'"
        className={clsx(
          'w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg',
          'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100',
          'placeholder-gray-500 dark:placeholder-gray-400',
          'focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
          'transition-colors duration-200'
        )}
      />
      {localQuery && (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          <XMarkIcon className="h-4 w-4 text-gray-400" />
        </button>
      )}
    </div>
  );
};

export default EmailSearchBar;
