import React, { useState } from 'react';
import { useEmailStore } from '../stores/emailStore';
import { 
  StarIcon,
  PaperClipIcon,
  ExclamationTriangleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import clsx from 'clsx';

const EmailFilters: React.FC = () => {
  const { 
    activeFilter, 
    setActiveFilter, 
    clearFilter,
    labels 
  } = useEmailStore();

  const [dateRange, setDateRange] = useState({ from: '', to: '' });

  const filterOptions = [
    {
      id: 'unread',
      label: 'Unread',
      icon: <div className="h-2 w-2 bg-blue-500 rounded-full" />,
      active: activeFilter.isUnread === true,
      onClick: () => setActiveFilter({ 
        ...activeFilter, 
        isUnread: activeFilter.isUnread === true ? undefined : true 
      })
    },
    {
      id: 'starred',
      label: 'Starred',
      icon: activeFilter.isStarred ? 
        <StarIconSolid className="h-4 w-4 text-yellow-400" /> : 
        <StarIcon className="h-4 w-4 text-gray-400" />,
      active: activeFilter.isStarred === true,
      onClick: () => setActiveFilter({ 
        ...activeFilter, 
        isStarred: activeFilter.isStarred === true ? undefined : true 
      })
    },
    {
      id: 'important',
      label: 'Important',
      icon: <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />,
      active: activeFilter.isImportant === true,
      onClick: () => setActiveFilter({ 
        ...activeFilter, 
        isImportant: activeFilter.isImportant === true ? undefined : true 
      })
    },
    {
      id: 'attachments',
      label: 'Has Attachments',
      icon: <PaperClipIcon className="h-4 w-4 text-gray-500" />,
      active: activeFilter.hasAttachments === true,
      onClick: () => setActiveFilter({ 
        ...activeFilter, 
        hasAttachments: activeFilter.hasAttachments === true ? undefined : true 
      })
    }
  ];

  const handleDateRangeChange = (field: 'from' | 'to', value: string) => {
    const newDateRange = { ...dateRange, [field]: value };
    setDateRange(newDateRange);
    
    const updates: any = { ...activeFilter };
    if (newDateRange.from) {
      updates.dateFrom = new Date(newDateRange.from);
    } else {
      delete updates.dateFrom;
    }
    if (newDateRange.to) {
      updates.dateTo = new Date(newDateRange.to);
    } else {
      delete updates.dateTo;
    }
    
    setActiveFilter(updates);
  };

  const handleLabelToggle = (labelId: string) => {
    const currentLabels = activeFilter.labels || [];
    const label = labels.find(l => l.id === labelId);
    if (!label) return;

    const isActive = currentLabels.includes(label.name);
    const newLabels = isActive 
      ? currentLabels.filter(l => l !== label.name)
      : [...currentLabels, label.name];
    
    setActiveFilter({
      ...activeFilter,
      labels: newLabels.length > 0 ? newLabels : undefined
    });
  };

  const hasActiveFilters = Object.keys(activeFilter).length > 0;

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800/50">
      <div className="flex flex-wrap gap-3 mb-4">
        {/* Quick Filter Buttons */}
        {filterOptions.map((option) => (
          <button
            key={option.id}
            onClick={option.onClick}
            className={clsx(
              'flex items-center space-x-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
              option.active
                ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-600'
                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
            )}
          >
            {option.icon}
            <span>{option.label}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Date Range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Date Range
          </label>
          <div className="space-y-2">
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => handleDateRangeChange('from', e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
              placeholder="From date"
            />
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => handleDateRangeChange('to', e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
              placeholder="To date"
            />
          </div>
        </div>

        {/* Sender Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            From Sender
          </label>
          <input
            type="text"
            value={activeFilter.from || ''}
            onChange={(e) => setActiveFilter({ ...activeFilter, from: e.target.value || undefined })}
            placeholder="sender@example.com"
            className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
          />
        </div>

        {/* Subject Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Subject Contains
          </label>
          <input
            type="text"
            value={activeFilter.subject || ''}
            onChange={(e) => setActiveFilter({ ...activeFilter, subject: e.target.value || undefined })}
            placeholder="Meeting, Invoice, etc."
            className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
          />
        </div>
      </div>

      {/* Labels */}
      {labels.length > 0 && (
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Labels
          </label>
          <div className="flex flex-wrap gap-2">
            {labels.map((label) => {
              const isActive = activeFilter.labels?.includes(label.name) || false;
              return (
                <button
                  key={label.id}
                  onClick={() => handleLabelToggle(label.id)}
                  className={clsx(
                    'flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border',
                    isActive
                      ? 'text-white border-transparent'
                      : 'text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'
                  )}
                  style={{
                    backgroundColor: isActive ? label.color : undefined,
                    borderColor: !isActive ? undefined : label.color
                  }}
                >
                  <div 
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: isActive ? 'white' : label.color }}
                  />
                  <span>{label.name}</span>
                  <span className="text-xs opacity-75">({label.count})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Clear Filters */}
      {hasActiveFilters && (
        <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={clearFilter}
            className="flex items-center space-x-1 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
          >
            <XMarkIcon className="h-4 w-4" />
            <span>Clear all filters</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default EmailFilters;
