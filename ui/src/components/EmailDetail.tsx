import React, { useState, useEffect } from 'react';
import { useEmailStore } from '../stores/emailStore';
import { formatEmailDate, downloadAttachment } from '../utils/emailUtils';
import { getApiUrl } from '../config/api';
import { 
  StarIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  TrashIcon,
  ArchiveBoxIcon,
  EllipsisVerticalIcon,
  PaperClipIcon,
  ChevronLeftIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import { EmailDetailSkeleton } from './LoadingSkeleton';
import toast from 'react-hot-toast';

interface FullEmailContent {
  body: string;
  htmlBody?: string;
  textBody?: string;
  attachments?: any[];
}

interface EmailSummary {
  summary: string;
  isLoading: boolean;
  error: string | null;
}

const EmailDetail: React.FC = () => {
  const { currentEmail, setCurrentEmail, toggleStar, archiveEmails, deleteEmails, updateEmail } = useEmailStore();
  const [fullContent, setFullContent] = useState<FullEmailContent | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<EmailSummary>({ summary: '', isLoading: false, error: null });
  
  if (!currentEmail) {
    return (
      <div className="h-full flex items-center justify-center bg-white dark:bg-slate-800">
        <div className="text-center">
          <div className="h-16 w-16 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <PaperClipIcon className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
            Select an email
          </h3>
          <p className="text-slate-600 dark:text-slate-400">
            Choose an email from the list to view its content
          </p>
        </div>
      </div>
    );
  }
  
  const handleReply = () => {
    // TODO: Implement reply functionality
    console.log('Reply to email:', currentEmail.id);
  };
  
  const handleForward = () => {
    // TODO: Implement forward functionality
    console.log('Forward email:', currentEmail.id);
  };
  
  const handleArchive = () => {
    archiveEmails([currentEmail.id]);
    setCurrentEmail(null);
  };
  
  const handleDelete = () => {
    deleteEmails([currentEmail.id]);
    setCurrentEmail(null);
  };
  
  const handleToggleStar = () => {
    toggleStar([currentEmail.id]);
  };
  
  const handleAttachmentDownload = async (attachment: any, index: number) => {
    try {
      await downloadAttachment(
        currentEmail.id, 
        index, 
        attachment.filename || `attachment_${index + 1}`
      );
      toast.success(`Downloaded ${attachment.filename}`);
    } catch (error) {
      toast.error(`Failed to download attachment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
  
  // Function to fetch full email content
  const fetchFullEmailContent = async (email: any) => {
    setIsLoadingContent(true);
    setContentError(null);
    
    try {
      // Get stored credentials
      const storedConfig = sessionStorage.getItem('imapConfig');
      if (!storedConfig) {
        throw new Error('No IMAP configuration found');
      }
      
      const config = JSON.parse(storedConfig);
      
      console.log('Fetching full content for email UID:', email.uid);
      
      const queryParams = new URLSearchParams({
        host: config.host,
        port: config.port?.toString() || '993',
        tls: config.tls !== false ? 'true' : 'false',
        username: config.username,
        password: config.password,
        folder: email.folder || 'INBOX'
      });
      
      const response = await fetch(`${getApiUrl('/emails')}/${email.uid}?${queryParams.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch email content: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.email) {
        const emailData = data.email;
        const content: FullEmailContent = {
          body: emailData.body || emailData.textBody || '',
          htmlBody: emailData.htmlBody,
          textBody: emailData.textBody,
          attachments: emailData.attachments || []
        };
        
        setFullContent(content);
        
        // Update the email in the store with full content
        updateEmail(email.id, {
          body: {
            text: emailData.textBody || emailData.body || '',
            html: emailData.htmlBody || ''
          },
          attachments: emailData.attachments || []
        });
        
        console.log('Full email content loaded successfully');
      } else {
        throw new Error(data.error || 'Failed to load email content');
      }
    } catch (error) {
      console.error('Error fetching full email content:', error);
      setContentError(error instanceof Error ? error.message : 'Failed to load email content');
    } finally {
      setIsLoadingContent(false);
    }
  };
  
  // Function to fetch AI summary
  const fetchAiSummary = async (email: any) => {
    setAiSummary(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      console.log('Fetching AI summary for email UID:', email.uid);
      
      const storedConfig = sessionStorage.getItem('imapConfig');
      if (!storedConfig) {
        throw new Error('No IMAP configuration found');
      }
      
      const config = JSON.parse(storedConfig);
      
      const queryParams = new URLSearchParams({
        host: config.host,
        port: config.port?.toString() || '993',
        tls: config.tls !== false ? 'true' : 'false',
        username: config.username,
        password: config.password,
        folder: email.folder || 'INBOX'
      });
      
      const response = await fetch(`${getApiUrl('/emails')}/${email.uid}/summarize?${queryParams.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch AI summary: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.summary) {
        // Handle summary being a string or object
        const summaryText = typeof data.summary === 'string' ? data.summary : data.summary?.summary || 'No summary available';
        setAiSummary({
          summary: summaryText,
          isLoading: false,
          error: null
        });
        console.log('AI summary loaded successfully:', summaryText);
      } else {
        throw new Error(data.error || 'Failed to load AI summary');
      }
    } catch (error) {
      console.error('Error fetching AI summary:', error);
      setAiSummary({
        summary: '',
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load AI summary'
      });
    }
  };
  
  // Effect to fetch full content and AI summary when email changes
  useEffect(() => {
    if (currentEmail && (!currentEmail.body.html && !currentEmail.body.text || currentEmail.body.text === currentEmail.preview)) {
      fetchFullEmailContent(currentEmail);
    } else if (currentEmail && (currentEmail.body.html || currentEmail.body.text)) {
      // Email already has full content
      setFullContent({
        body: currentEmail.body.text || '',
        htmlBody: currentEmail.body.html,
        textBody: currentEmail.body.text,
        attachments: currentEmail.attachments || []
      });
    }
    
    // Always fetch AI summary when email changes
    if (currentEmail) {
      fetchAiSummary(currentEmail);
    } else {
      // Reset AI summary when no email selected
      setAiSummary({ summary: '', isLoading: false, error: null });
    }
  }, [currentEmail?.id]);
  
  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-800">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="p-4">
          {/* Actions Bar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setCurrentEmail(null)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors md:hidden"
                title="Back to list"
              >
                <ChevronLeftIcon className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              </button>
              
              <button
                onClick={handleToggleStar}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                title={currentEmail.isStarred ? 'Remove star' : 'Add star'}
              >
                {currentEmail.isStarred ? (
                  <StarIconSolid className="h-5 w-5 text-yellow-400" />
                ) : (
                  <StarIcon className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                )}
              </button>
              
              <button
                onClick={handleReply}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                title="Reply"
              >
                <ArrowUturnLeftIcon className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              </button>
              
              <button
                onClick={handleForward}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                title="Forward"
              >
                <ArrowUturnRightIcon className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              </button>
              
              <button
                onClick={handleArchive}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                title="Archive"
              >
                <ArchiveBoxIcon className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              </button>
              
              <button
                onClick={handleDelete}
                className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
                title="Delete"
              >
                <TrashIcon className="h-5 w-5 text-red-600 dark:text-red-400" />
              </button>
            </div>
            
            <button className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
              <EllipsisVerticalIcon className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            </button>
          </div>

          {/* Email Header */}
          <div className="space-y-3">
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              {currentEmail.subject}
            </h1>
            
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 bg-[#1a73e8] rounded-full flex items-center justify-center">
                  <span className="text-white font-medium text-sm">
                    {(currentEmail.from.name || currentEmail.from.address).charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {currentEmail.from.name || currentEmail.from.address}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatEmailDate(currentEmail.date)}
                  </p>
                </div>
              </div>
              
              {currentEmail.hasAttachments && (
                <div className="flex items-center space-x-1 text-slate-500 dark:text-slate-400">
                  <PaperClipIcon className="h-4 w-4" />
                  <span className="text-sm">
                    {currentEmail.attachments?.length || 0} attachment{(currentEmail.attachments?.length || 0) !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoadingContent ? (
          <EmailDetailSkeleton />
        ) : contentError ? (
          <div className="p-6 text-center">
            <div className="h-12 w-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
              Failed to load email
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              {contentError}
            </p>
            <button
              onClick={() => fetchFullEmailContent(currentEmail)}
              className="btn-primary"
            >
              Try Again
            </button>
          </div>
        ) : (
          <div className="p-6">
            {/* Email Body */}
            <div className="prose prose-slate dark:prose-invert max-w-none">
              {fullContent?.htmlBody ? (
                <div 
                  dangerouslySetInnerHTML={{ __html: fullContent.htmlBody }}
                  className="text-slate-900 dark:text-slate-100"
                />
              ) : (
                <div className="whitespace-pre-wrap text-slate-900 dark:text-slate-100">
                  {fullContent?.textBody || fullContent?.body || currentEmail.preview}
                </div>
              )}
            </div>

            {/* AI Summary */}
            {(aiSummary.summary || aiSummary.isLoading || aiSummary.error) && (
              <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
                  AI Summary
                </h3>
                {aiSummary.isLoading ? (
                  <div className="flex items-center space-x-2 text-slate-500 dark:text-slate-400">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-300 border-t-slate-600"></div>
                    <span className="text-sm">Generating summary...</span>
                  </div>
                ) : aiSummary.error ? (
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <p className="text-sm text-amber-700 dark:text-amber-300 leading-relaxed">
                      AI summary unavailable: {aiSummary.error.includes('Gemini') ? 'AI service not configured' : aiSummary.error}
                    </p>
                  </div>
                ) : aiSummary.summary ? (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                      {aiSummary.summary}
                    </p>
                  </div>
                ) : null}
              </div>
            )}

            {/* Attachments */}
            {fullContent?.attachments && fullContent.attachments.length > 0 && (
              <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
                  Attachments ({fullContent.attachments.length})
                </h3>
                <div className="space-y-2">
                  {fullContent.attachments.map((attachment, index) => (
                    <div
                      key={index}
                      className="flex items-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600"
                    >
                      <PaperClipIcon className="h-5 w-5 text-slate-400 mr-3" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                          {attachment.filename || `Attachment ${index + 1}`}
                        </p>
                        {attachment.size && (
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {(attachment.size / 1024).toFixed(1)} KB
                          </p>
                        )}
                      </div>
                      <button 
                        onClick={() => handleAttachmentDownload(attachment, index)}
                        className="text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Download
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailDetail;
