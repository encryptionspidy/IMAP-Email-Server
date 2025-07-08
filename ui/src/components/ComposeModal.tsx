import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import { useEmailStore } from '../stores/emailStore';
import { 
  XMarkIcon,
  PaperClipIcon,
  DocumentIcon,
  TrashIcon,
  PaperAirplaneIcon,
  BookmarkIcon,
  EyeIcon,
  CodeBracketIcon
} from '@heroicons/react/24/outline';
import { formatFileSize, parseEmailAddresses, validateEmail } from '../utils/emailUtils';
import { getApiUrl } from '../config/api';
import clsx from 'clsx';
import toast from 'react-hot-toast';

interface ComposeModalProps {
  onClose: () => void;
  replyTo?: string;
  forwardFrom?: string;
  className?: string;
}

interface Attachment {
  id: string;
  file: File;
  preview?: string;
}

const ComposeModal: React.FC<ComposeModalProps> = ({ 
  onClose, 
  replyTo, 
  forwardFrom,
  className 
}) => {
  const { composition, setComposition, resetComposition, templates } = useEmailStore();
  
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState(composition.subject || '');
  const [body, setBody] = useState(composition.body || '');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [isRichText, setIsRichText] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: useCallback((acceptedFiles: File[]) => {
      const newAttachments = acceptedFiles.map(file => ({
        id: Math.random().toString(36).substr(2, 9),
        file,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
      }));
      setAttachments(prev => [...prev, ...newAttachments]);
    }, []),
    noClick: true,
    noKeyboard: true
  });

  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => {
      const attachment = prev.find(a => a.id === id);
      if (attachment?.preview) {
        URL.revokeObjectURL(attachment.preview);
      }
      return prev.filter(a => a.id !== id);
    });
  }, []);

  const validateEmails = useCallback((emailString: string) => {
    if (!emailString.trim()) return [];
    const addresses = parseEmailAddresses(emailString);
    const invalid = addresses.filter(addr => !validateEmail(addr.address));
    return invalid;
  }, []);

  const handleSend = useCallback(async () => {
    // Validate recipients
    const invalidTo = validateEmails(to);
    const invalidCc = validateEmails(cc);
    const invalidBcc = validateEmails(bcc);
    
    if (invalidTo.length > 0 || invalidCc.length > 0 || invalidBcc.length > 0) {
      toast.error('Please check email addresses for errors');
      return;
    }

    if (!to.trim()) {
      toast.error('Please add at least one recipient');
      return;
    }

    if (!subject.trim()) {
      toast.error('Please add a subject');
      return;
    }

    setIsSending(true);

    try {
      // Get stored SMTP configuration
      const storedConfig = sessionStorage.getItem('imapConfig');
      if (!storedConfig) {
        throw new Error('No email configuration found');
      }
      
      const config = JSON.parse(storedConfig);
      
      // Prepare email data for sending
      const emailData = {
        from: config.username,
        to: parseEmailAddresses(to),
        cc: cc ? parseEmailAddresses(cc) : undefined,
        bcc: bcc ? parseEmailAddresses(bcc) : undefined,
        subject,
        body,
        isHtml: isRichText,
        attachments: attachments.map(a => ({
          filename: a.file.name,
          content: a.file,
          contentType: a.file.type
        })),
        replyTo,
        forwardFrom,
        smtpConfig: {
          host: 'smtp.gmail.com', // This should come from account settings
          port: 587,
          secure: false,
          auth: {
            user: config.username,
            pass: config.password
          }
        }
      };

      console.log('Sending email via SMTP API:', {
        to: emailData.to.map(addr => addr.address),
        subject: emailData.subject,
        attachmentCount: emailData.attachments.length
      });
      
      // Convert files to base64 for API transmission
      const attachmentsWithContent = await Promise.all(
        attachments.map(async (attachment) => {
          const base64Content = await fileToBase64(attachment.file);
          return {
            filename: attachment.file.name,
            content: base64Content,
            contentType: attachment.file.type,
            size: attachment.file.size
          };
        })
      );
      
      const response = await fetch(getApiUrl('/emails/send'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          smtpConfig: {
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            username: config.username,
            password: config.password
          },
          emailData: {
            to: parseEmailAddresses(to).map(addr => addr.address),
            cc: cc ? parseEmailAddresses(cc).map(addr => addr.address) : undefined,
            bcc: bcc ? parseEmailAddresses(bcc).map(addr => addr.address) : undefined,
            subject,
            body,
            htmlBody: isRichText ? body : undefined,
            attachments: attachmentsWithContent
          }
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send email');
      }
      
      const result = await response.json();
      
      if (result.success) {
        toast.success('Email sent successfully!');
        resetComposition();
        onClose();
      } else {
        throw new Error(result.error || 'Failed to send email');
      }
      
    } catch (error) {
      toast.error(`Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('Send email error:', error);
    } finally {
      setIsSending(false);
    }
  }, [to, cc, bcc, subject, body, attachments, replyTo, forwardFrom, validateEmails, resetComposition, onClose]);

  const handleSaveDraft = useCallback(() => {
    setComposition({
      to: parseEmailAddresses(to),
      cc: cc ? parseEmailAddresses(cc) : undefined,
      bcc: bcc ? parseEmailAddresses(bcc) : undefined,
      subject,
      body,
      attachments: attachments.map(a => a.file)
    });
    toast.success('Draft saved');
  }, [to, cc, bcc, subject, body, attachments, setComposition]);
  
  // File to base64 conversion utility
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data:image/png;base64, prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleTemplateSelect = useCallback((template: any) => {
    setSubject(template.subject);
    setBody(template.body);
    setShowTemplates(false);
    toast.success('Template applied');
  }, []);

  const insertFormattingAtCursor = useCallback((before: string, after: string = '') => {
    const textarea = bodyRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = body.substring(start, end);
    const newText = body.substring(0, start) + before + selectedText + after + body.substring(end);
    
    setBody(newText);
    
    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, end + before.length);
    }, 0);
  }, [body]);

  const formatButtons = [
    { label: 'Bold', action: () => insertFormattingAtCursor('**', '**'), shortcut: 'Ctrl+B' },
    { label: 'Italic', action: () => insertFormattingAtCursor('*', '*'), shortcut: 'Ctrl+I' },
    { label: 'Link', action: () => insertFormattingAtCursor('[', '](url)'), shortcut: 'Ctrl+K' },
    { label: 'List', action: () => insertFormattingAtCursor('\n- ', ''), shortcut: null }
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className={clsx(
            'relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-gray-800 rounded-xl shadow-2xl',
            'flex flex-col overflow-hidden',
            className
          )}
        >
          <div {...getRootProps()} className="h-full">
            <input {...getInputProps()} />
          
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {replyTo ? 'Reply' : forwardFrom ? 'Forward' : 'Compose Email'}
              </h2>
              
              {templates.length > 0 && (
                <button
                  onClick={() => setShowTemplates(!showTemplates)}
                  className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <BookmarkIcon className="h-4 w-4 inline mr-1" />
                  Templates
                </button>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsRichText(!isRichText)}
                className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title={isRichText ? 'Switch to plain text' : 'Switch to rich text'}
              >
                {isRichText ? (
                  <CodeBracketIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                ) : (
                  <EyeIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                )}
              </button>
              
              <button
                onClick={onClose}
                className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <XMarkIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          </div>

          {/* Templates Dropdown */}
          {showTemplates && (
            <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 p-3">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleTemplateSelect(template)}
                    className="p-3 text-left bg-white dark:bg-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors border border-gray-200 dark:border-gray-600"
                  >
                    <div className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                      {template.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                      {template.subject}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Form */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 space-y-3">
              {/* To Field */}
              <div className="flex items-center space-x-3">
                <label className="w-12 text-sm font-medium text-gray-700 dark:text-gray-300">To:</label>
                <input
                  type="text"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="recipient@example.com"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <div className="flex space-x-1">
                  <button
                    onClick={() => setShowCc(!showCc)}
                    className={clsx(
                      'px-2 py-1 text-xs rounded transition-colors',
                      showCc 
                        ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                    )}
                  >
                    Cc
                  </button>
                  <button
                    onClick={() => setShowBcc(!showBcc)}
                    className={clsx(
                      'px-2 py-1 text-xs rounded transition-colors',
                      showBcc 
                        ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                    )}
                  >
                    Bcc
                  </button>
                </div>
              </div>

              {/* Cc Field */}
              {showCc && (
                <div className="flex items-center space-x-3">
                  <label className="w-12 text-sm font-medium text-gray-700 dark:text-gray-300">Cc:</label>
                  <input
                    type="text"
                    value={cc}
                    onChange={(e) => setCc(e.target.value)}
                    placeholder="cc@example.com"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              )}

              {/* Bcc Field */}
              {showBcc && (
                <div className="flex items-center space-x-3">
                  <label className="w-12 text-sm font-medium text-gray-700 dark:text-gray-300">Bcc:</label>
                  <input
                    type="text"
                    value={bcc}
                    onChange={(e) => setBcc(e.target.value)}
                    placeholder="bcc@example.com"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              )}

              {/* Subject Field */}
              <div className="flex items-center space-x-3">
                <label className="w-12 text-sm font-medium text-gray-700 dark:text-gray-300">Subject:</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Email subject"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Formatting Toolbar */}
              {isRichText && (
                <div className="border border-gray-300 dark:border-gray-600 rounded-md p-2 bg-gray-50 dark:bg-gray-700/50">
                  <div className="flex items-center space-x-2">
                    {formatButtons.map((button, index) => (
                      <button
                        key={index}
                        onClick={button.action}
                        className="px-2 py-1 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                        title={button.shortcut || button.label}
                      >
                        {button.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Body Field */}
              <div>
                <textarea
                  ref={bodyRef}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write your email..."
                  rows={12}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
              </div>

              {/* Attachments */}
              {attachments.length > 0 && (
                <div className="border border-gray-300 dark:border-gray-600 rounded-md p-3">
                  <div className="flex items-center mb-2">
                    <PaperClipIcon className="h-4 w-4 text-gray-500 mr-2" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Attachments ({attachments.length})
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {attachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="flex items-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded border border-gray-200 dark:border-gray-600"
                      >
                        {attachment.preview ? (
                          <img
                            src={attachment.preview}
                            alt={attachment.file.name}
                            className="h-8 w-8 object-cover rounded mr-2"
                          />
                        ) : (
                          <DocumentIcon className="h-8 w-8 text-gray-400 mr-2" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {attachment.file.name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {formatFileSize(attachment.file.size)}
                          </div>
                        </div>
                        <button
                          onClick={() => removeAttachment(attachment.id)}
                          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                          <TrashIcon className="h-4 w-4 text-red-500" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Drag and Drop Overlay */}
              {isDragActive && (
                <div className="absolute inset-0 bg-blue-50 dark:bg-blue-900/20 border-2 border-dashed border-blue-300 dark:border-blue-600 rounded-lg flex items-center justify-center z-10">
                  <div className="text-center">
                    <PaperClipIcon className="h-12 w-12 text-blue-500 mx-auto mb-2" />
                    <p className="text-lg font-medium text-blue-700 dark:text-blue-300">
                      Drop files here to attach
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <label className="flex items-center cursor-pointer">
                  <input {...getInputProps()} />
                  <div className="flex items-center space-x-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                    <PaperClipIcon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Attach</span>
                  </div>
                </label>
                
                <button
                  onClick={handleSaveDraft}
                  className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Save Draft
                </button>
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSend}
                  disabled={isSending || !to.trim() || !subject.trim()}
                  className={clsx(
                    'flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-md transition-colors',
                    isSending || !to.trim() || !subject.trim()
                      ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  )}
                >
                  {isSending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <PaperAirplaneIcon className="h-4 w-4" />
                      <span>Send</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ComposeModal;
