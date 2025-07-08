import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from 'date-fns';
import { Email, EmailAddress } from '../types/email';
import { getApiUrl } from '../config/api';

export const formatEmailDate = (date: Date | string): string => {
  const parsedDate = typeof date === 'string' ? parseISO(date) : date;
  
  if (isToday(parsedDate)) {
    return format(parsedDate, 'HH:mm');
  } else if (isYesterday(parsedDate)) {
    return 'Yesterday';
  } else {
    return format(parsedDate, 'MMM d');
  }
};

export const formatRelativeTime = (date: Date | string): string => {
  const parsedDate = typeof date === 'string' ? parseISO(date) : date;
  return formatDistanceToNow(parsedDate, { addSuffix: true });
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const formatEmailAddress = (address: EmailAddress): string => {
  return address.name ? `${address.name} <${address.address}>` : address.address;
};

export const formatEmailAddresses = (addresses: EmailAddress[]): string => {
  return addresses.map(formatEmailAddress).join(', ');
};

export const getEmailPreview = (email: Email, maxLength: number = 100): string => {
  // If we have a custom preview, use it
  if (email.preview && email.preview !== email.subject) {
    return email.preview.length > maxLength ? email.preview.substring(0, maxLength) + '...' : email.preview;
  }
  
  // Extract meaningful content from body
  let content = '';
  if (email.body.text) {
    content = email.body.text;
  } else if (email.body.html) {
    content = stripHtml(email.body.html);
  }
  
  // Clean up the content
  content = content
    .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
    .replace(/^\s*>.*$/gm, '') // Remove quoted text lines
    .trim();
  
  // If no meaningful content, return subject as fallback
  if (!content || content.length < 10) {
    return email.subject;
  }
  
  return content.length > maxLength ? content.substring(0, maxLength) + '...' : content;
};

export const stripHtml = (html: string): string => {
  if (!html) return '';
  
  const temp = document.createElement('div');
  temp.innerHTML = html;
  
  // Remove script and style elements
  const scripts = temp.querySelectorAll('script, style');
  scripts.forEach(el => el.remove());
  
  let text = temp.textContent || temp.innerText || '';
  
  // Clean up common email artifacts
  text = text
    .replace(/\r\n/g, '\n')
    .replace(/\n\s*\n/g, '\n') // Remove empty lines
    .replace(/^\s+|\s+$/gm, '') // Trim each line
    .trim();
  
  return text;
};

export const getEmailInitials = (email: EmailAddress): string => {
  if (email.name) {
    const parts = email.name.split(' ');
    return parts.length > 1 
      ? parts[0][0] + parts[parts.length - 1][0] 
      : parts[0][0];
  }
  return email.address[0];
};

export const getEmailColor = (email: EmailAddress): string => {
  const colors = [
    'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500',
    'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-gray-500',
    'bg-orange-500', 'bg-teal-500'
  ];
  
  let hash = 0;
  const str = email.address;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = Math.abs(hash);
  
  return colors[hash % colors.length];
};

export const parseEmailAddresses = (input: string): EmailAddress[] => {
  const addresses: EmailAddress[] = [];
  const regex = /(?:"([^"]+)"\s*<([^>]+)>|([^<,]+)<([^>]+)>|([^,]+))/g;
  let match;
  
  while ((match = regex.exec(input)) !== null) {
    if (match[1] && match[2]) {
      // "Name" <email@domain.com>
      addresses.push({ name: match[1].trim(), address: match[2].trim() });
    } else if (match[3] && match[4]) {
      // Name <email@domain.com>
      addresses.push({ name: match[3].trim(), address: match[4].trim() });
    } else if (match[5]) {
      // email@domain.com or just a name
      const addr = match[5].trim();
      if (addr.includes('@')) {
        addresses.push({ address: addr });
      }
    }
  }
  
  return addresses;
};

export const validateEmail = (email: string): boolean => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

export const generateEmailId = (): string => {
  return Math.random().toString(36).substr(2, 9);
};

export const sanitizeHtml = (html: string): string => {
  // Basic HTML sanitization - in production, use a proper library like DOMPurify
  const temp = document.createElement('div');
  temp.innerHTML = html;
  
  // Remove script tags
  const scripts = temp.querySelectorAll('script');
  scripts.forEach(script => script.remove());
  
  // Remove dangerous attributes
  const allElements = temp.querySelectorAll('*');
  allElements.forEach(element => {
    Array.from(element.attributes).forEach(attr => {
      if (attr.name.startsWith('on') || attr.name === 'javascript:') {
        element.removeAttribute(attr.name);
      }
    });
  });
  
  return temp.innerHTML;
};

export const getEmailPriority = (email: Email): 'high' | 'normal' | 'low' => {
  if (email.isImportant) return 'high';
  if (email.isStarred) return 'high';
  return 'normal';
};

export const groupEmailsByDate = (emails: Email[]): Record<string, Email[]> => {
  const groups: Record<string, Email[]> = {};
  
  emails.forEach(email => {
    const date = format(email.date, 'yyyy-MM-dd');
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(email);
  });
  
  return groups;
};

export const searchEmails = (emails: Email[], query: string): Email[] => {
  if (!query.trim()) return emails;
  
  const searchTerms = query.toLowerCase().split(' ');
  
  return emails.filter(email => {
    const searchableText = [
      email.subject,
      email.from.name || '',
      email.from.address,
      ...email.to.map(addr => addr.name || addr.address),
      email.body.text || stripHtml(email.body.html || ''),
      ...email.labels,
      email.folder
    ].join(' ').toLowerCase();
    
    return searchTerms.every(term => searchableText.includes(term));
  });
};

export const highlightSearchTerms = (text: string, query: string): string => {
  if (!query.trim()) return text;
  
  const searchTerms = query.split(' ').filter(term => term.length > 0);
  let highlightedText = text;
  
  searchTerms.forEach(term => {
    const regex = new RegExp(`(${term})`, 'gi');
    highlightedText = highlightedText.replace(regex, '<mark class="bg-yellow-200">$1</mark>');
  });
  
  return highlightedText;
};

export const getEmailThreads = (emails: Email[]): Record<string, Email[]> => {
  const threads: Record<string, Email[]> = {};
  
  emails.forEach(email => {
    const threadId = email.threadId || email.id;
    if (!threads[threadId]) {
      threads[threadId] = [];
    }
    threads[threadId].push(email);
  });
  
  // Sort emails within each thread by date
  Object.keys(threads).forEach(threadId => {
    threads[threadId].sort((a, b) => a.date.getTime() - b.date.getTime());
  });
  
  return threads;
};

export const generateReplySubject = (originalSubject: string): string => {
  if (originalSubject.toLowerCase().startsWith('re:')) {
    return originalSubject;
  }
  return `Re: ${originalSubject}`;
};

export const generateForwardSubject = (originalSubject: string): string => {
  if (originalSubject.toLowerCase().startsWith('fwd:')) {
    return originalSubject;
  }
  return `Fwd: ${originalSubject}`;
};

export const getReplyToAddress = (email: Email): EmailAddress => {
  if (email.replyTo && email.replyTo.length > 0) {
    return email.replyTo[0];
  }
  return email.from;
};

export const createQuotedReply = (email: Email): string => {
  const date = format(email.date, 'PPP');
  const fromAddress = formatEmailAddress(email.from);
  const originalText = email.body.text || stripHtml(email.body.html || '');
  
  return `\n\nOn ${date}, ${fromAddress} wrote:\n${originalText.split('\n').map(line => `> ${line}`).join('\n')}`;
};

// Attachment download utility
export const downloadAttachment = async (emailUid: string, attachmentIndex: number, filename: string): Promise<void> => {
  try {
    // Get stored credentials
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
      folder: 'INBOX' // Could be made dynamic
    });
    
    const response = await fetch(`${getApiUrl('/emails')}/${emailUid}/attachments/${attachmentIndex}?${queryParams.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Failed to download attachment: ${response.statusText}`);
    }
    
    const blob = await response.blob();
    
    // Create download link
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading attachment:', error);
    throw error;
  }
};

// Cache utilities for performance
export const createEmailCache = () => {
  const cache = new Map<string, Email>();
  const maxSize = 100; // Maximum number of emails to cache
  
  return {
    get: (id: string): Email | undefined => cache.get(id),
    set: (id: string, email: Email): void => {
      if (cache.size >= maxSize) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
      }
      cache.set(id, email);
    },
    clear: (): void => cache.clear(),
    has: (id: string): boolean => cache.has(id),
    size: (): number => cache.size
  };
};

// Debounce utility for search
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
let timeout: number;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};
