import React from 'react';

interface SkeletonProps {
  className?: string;
  lines?: number;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', lines = 1 }) => {
  return (
    <div className={`animate-pulse ${className}`}>
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className="h-4 bg-slate-200 dark:bg-slate-700 rounded mb-2"
          style={{
            width: `${Math.random() * 40 + 60}%`,
          }}
        />
      ))}
    </div>
  );
};

export const EmailSkeleton: React.FC = () => {
  return (
    <div className="p-4 border-b border-slate-200 dark:border-slate-700">
      <div className="flex items-center space-x-3">
        <div className="h-4 w-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        <div className="h-4 w-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        <div className="flex-1">
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded mb-2 animate-pulse" style={{ width: '60%' }} />
          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" style={{ width: '80%' }} />
        </div>
        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" style={{ width: '40px' }} />
      </div>
    </div>
  );
};

export const EmailListSkeleton: React.FC = () => {
  return (
    <div className="flex flex-col h-full">
      {/* Header skeleton */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" style={{ width: '120px' }} />
          <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" style={{ width: '80px' }} />
        </div>
      </div>
      
      {/* Search bar skeleton */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
      </div>
      
      {/* Email items skeleton */}
      <div className="flex-1">
        {Array.from({ length: 8 }).map((_, index) => (
          <EmailSkeleton key={index} />
        ))}
      </div>
    </div>
  );
};

export const EmailDetailSkeleton: React.FC = () => {
  return (
    <div className="flex flex-col h-full p-6">
      {/* Header skeleton */}
      <div className="mb-6">
        <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-3" style={{ width: '70%' }} />
        <div className="flex items-center space-x-4 mb-4">
          <div className="h-10 w-10 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse" />
          <div className="flex-1">
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-2" style={{ width: '40%' }} />
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" style={{ width: '60%' }} />
          </div>
        </div>
      </div>
      
      {/* Content skeleton */}
      <div className="flex-1">
        <Skeleton lines={3} className="mb-4" />
        <Skeleton lines={5} className="mb-4" />
        <Skeleton lines={4} className="mb-4" />
        <Skeleton lines={6} />
      </div>
    </div>
  );
};

export default Skeleton; 