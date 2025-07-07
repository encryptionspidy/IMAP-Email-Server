// IMAP connection configuration
export interface ImapConfig {
  host: string;
  port: number;
  tls: boolean;
  username: string;
  password: string;
}

// User authentication
export interface User {
  id: string;
  email: string;
  hashedPassword: string;
  emailAccounts: UserEmailAccount[];
  preferences: UserPreferences;
  createdAt: string;
  updatedAt: string;
}

export interface UserEmailAccount {
  id: string;
  name: string;
  config: ImapConfig;
  isDefault: boolean;
  smtpConfig?: SmtpConfig;
}

export interface UserPreferences {
  theme: 'light' | 'dark';
  emailsPerPage: number;
  autoRefreshInterval: number;
  showEmailPreview: boolean;
  defaultFolder: string;
}

// SMTP configuration for sending emails
export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
}

// JWT tokens
export interface JwtPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}

export interface ApiKeyPayload extends JwtPayload {
  type: 'api';
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: Omit<User, 'hashedPassword'>;
  error?: string;
}

// Email message metadata
export interface EmailMetadata {
  uid: string;
  subject: string;
  from: string;
  to: string;
  cc?: string;
  bcc?: string;
  date: string;
  flags: string[];
  size: number;
  hasAttachments?: boolean;
  isRead?: boolean;
  isStarred?: boolean;
  threadId?: string;
  labels?: string[];
  priority?: 'high' | 'normal' | 'low';
  encoding?: string;
}

// Full email message with body
export interface EmailMessage extends EmailMetadata {
  headers: Record<string, string>;
  body: string;
  htmlBody?: string;
  textBody?: string;
  attachments?: EmailAttachment[];
  structure?: EmailStructure;
  references?: string[];
  inReplyTo?: string;
  messageId?: string;
  sanitizedHtml?: string;
}

// Email structure for MIME parsing
export interface EmailStructure {
  type: string;
  subtype: string;
  encoding?: string;
  charset?: string;
  disposition?: {
    type: string;
    params?: Record<string, string>;
  };
  children?: EmailStructure[];
}

// Email attachment
export interface EmailAttachment {
  filename: string;
  contentType: string;
  size: number;
  content?: Buffer;
  contentId?: string;
  disposition?: 'attachment' | 'inline';
  encoding?: string;
  checksum?: string;
}

// API request/response types
export interface ListEmailsRequest {
  host: string;
  port: number;
  tls: boolean;
  username: string;
  password: string;
  folder?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'date' | 'subject' | 'from' | 'size';
  sortOrder?: 'asc' | 'desc';
  search?: EmailSearchQuery;
}

export interface EmailSearchQuery {
  query?: string;
  from?: string;
  to?: string;
  subject?: string;
  body?: string;
  dateFrom?: string;
  dateTo?: string;
  hasAttachments?: boolean;
  isRead?: boolean;
  flags?: string[];
  size?: {
    min?: number;
    max?: number;
  };
}

export interface ListEmailsResponse {
  success: boolean;
  emails: EmailMetadata[];
  total: number;
  hasMore?: boolean;
  nextOffset?: number;
  error?: string;
}

export interface GetEmailResponse {
  success: boolean;
  email?: EmailMessage;
  error?: string;
}

// Email composition and sending
export interface ComposeEmailRequest {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  htmlBody?: string;
  attachments?: EmailAttachment[];
  replyToUid?: string;
  forwardUid?: string;
}

export interface SendEmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Email operations
export interface EmailOperation {
  type: 'mark_read' | 'mark_unread' | 'star' | 'unstar' | 'delete' | 'move' | 'copy' | 'add_label' | 'remove_label';
  uids: string[];
  folder?: string;
  targetFolder?: string;
  labels?: string[];
}

export interface EmailOperationResponse {
  success: boolean;
  processed: number;
  error?: string;
}

// Folder management
export interface EmailFolder {
  name: string;
  path: string;
  delimiter: string;
  flags: string[];
  children?: EmailFolder[];
  unreadCount?: number;
  totalCount?: number;
}

export interface ListFoldersResponse {
  success: boolean;
  folders: EmailFolder[];
  error?: string;
}

// AI summary response
export interface EmailSummary {
  summary: string;
  keyPoints: string[];
  sentiment: 'positive' | 'negative' | 'neutral';
  urgency: 'high' | 'medium' | 'low';
  category?: string;
  language?: string;
  actionItems?: string[];
  meetingInfo?: {
    hasDateTime: boolean;
    dateTime?: string;
    location?: string;
    attendees?: string[];
  };
  contacts?: {
    emails: string[];
    phones: string[];
    names: string[];
  };
}

// Enhanced AI features
export interface EmailClassification {
  category: 'work' | 'personal' | 'finance' | 'travel' | 'shopping' | 'social' | 'newsletter' | 'spam' | 'other';
  confidence: number;
  subcategory?: string;
}

export interface EmailAnalytics {
  threadLength: number;
  responseTime?: number;
  isNewsletter: boolean;
  hasLinks: boolean;
  hasImages: boolean;
  wordCount: number;
  readingTime: number;
  languageDetected?: string;
}

// Caching interfaces
export interface CacheItem<T> {
  key: string;
  value: T;
  ttl: number;
  createdAt: number;
}

export interface CacheConfig {
  emailTtl: number;
  listTtl: number;
  folderTtl: number;
  maxSize: number;
}

// Error types
export class ImapConnectionError extends Error {
  constructor(message: string, public readonly originalError?: Error) {
    super(message);
    this.name = 'ImapConnectionError';
  }
}

export class EmailNotFoundError extends Error {
  constructor(uid: string) {
    super(`Email with UID ${uid} not found`);
    this.name = 'EmailNotFoundError';
  }
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public readonly field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class RateLimitError extends Error {
  constructor(message: string, public readonly retryAfter?: number) {
    super(message);
    this.name = 'RateLimitError';
  }
}
