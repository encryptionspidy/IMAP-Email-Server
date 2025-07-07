export interface EmailAddress {
  name?: string;
  address: string;
}

export interface EmailAttachment {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
  url?: string;
  preview?: string;
}

export interface EmailLabel {
  id: string;
  name: string;
  color: string;
  count: number;
}

export interface EmailThread {
  id: string;
  subject: string;
  participants: EmailAddress[];
  messages: Email[];
  lastMessageAt: Date;
  unreadCount: number;
  labels: string[];
}

export interface Email {
  id: string;
  messageId: string;
  threadId?: string;
  subject: string;
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  replyTo?: EmailAddress[];
  date: Date;
  body: {
    html?: string;
    text?: string;
  };
  attachments: EmailAttachment[];
  labels: string[];
  isRead: boolean;
  isStarred: boolean;
  isImportant: boolean;
  isDraft: boolean;
  isDeleted: boolean;
  flags: string[];
  folder: string;
  preview?: string;
  size: number;
  hasAttachments: boolean;
}

export interface EmailFolder {
  id: string;
  name: string;
  path: string;
  type: 'inbox' | 'sent' | 'drafts' | 'trash' | 'spam' | 'custom';
  unreadCount: number;
  totalCount: number;
  children?: EmailFolder[];
}

export interface EmailFilter {
  from?: string;
  to?: string;
  subject?: string;
  body?: string;
  hasAttachments?: boolean;
  isUnread?: boolean;
  isStarred?: boolean;
  isImportant?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  labels?: string[];
  folders?: string[];
}

export interface EmailSearchResult {
  emails: Email[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}

export interface EmailComposition {
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  subject: string;
  body: string;
  attachments: File[];
  replyTo?: string;
  forwardFrom?: string;
  template?: string;
  scheduledAt?: Date;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  isDefault: boolean;
  category: string;
}

export interface EmailAccount {
  id: string;
  name: string;
  email: string;
  provider: string;
  isConnected: boolean;
  settings: {
    imapHost: string;
    imapPort: number;
    smtpHost: string;
    smtpPort: number;
    useSSL: boolean;
  };
}

export interface KeyboardShortcut {
  key: string;
  description: string;
  action: () => void;
}

export interface EmailClientSettings {
  theme: 'light' | 'dark' | 'system';
  language: string;
  timezone: string;
  emailsPerPage: number;
  autoMarkAsRead: boolean;
  showPreview: boolean;
  enableNotifications: boolean;
  playSound: boolean;
  keyboardShortcuts: KeyboardShortcut[];
  signature: string;
  defaultFontSize: number;
  compactView: boolean;
  rightToLeft: boolean;
}
