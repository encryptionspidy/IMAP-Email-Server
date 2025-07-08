import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import sanitizeHtml from 'sanitize-html';
import { 
  ImapConfig, 
  EmailMetadata, 
  EmailMessage, 
  EmailFolder,
  EmailAttachment,
  ImapConnectionError, 
  EmailNotFoundError 
} from '../types';

export class WorkingImapClient {
  private connection: ImapFlow | null = null;
  private currentFolder: string = '';

  constructor() {
    // Remove unused cache and connectionId properties
  }

  /**
   * Connect to IMAP server
   */
  async connect(config: ImapConfig): Promise<void> {
    try {
      console.log(`🔌 Connecting to IMAP server: ${config.host}:${config.port}`);
      console.log(`🔐 Using TLS: ${config.tls}`);
      console.log(`👤 Username: ${config.username}`);
      
      this.connection = new ImapFlow({
        host: config.host,
        port: config.port,
        secure: config.tls,
        auth: {
          user: config.username,
          pass: config.password,
        },
        logger: console, // Enable debug logging
      });

      await this.connection.connect();
      console.log('✅ IMAP connection established successfully');
    } catch (error) {
      console.error('❌ IMAP connection failed:', error);
      throw new ImapConnectionError(
        `Failed to connect to IMAP server ${config.host}:${config.port}`,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Disconnect from IMAP server
   */
  async disconnect(): Promise<void> {
    if (this.connection) {
      try {
        await this.connection.logout();
        this.connection = null;
        this.currentFolder = '';
        console.log('IMAP connection closed');
      } catch (error) {
        console.warn('Error during IMAP disconnect:', error);
      }
    }
  }

  /**
   * Get Gmail folder mapping
   */
  private getGmailFolderPath(folder: string): string {
    const gmailFolderMap: { [key: string]: string } = {
      'INBOX': 'INBOX',
      'SENT': '[Gmail]/Sent Mail',
      'DRAFTS': '[Gmail]/Drafts',
      'SPAM': '[Gmail]/Spam',
      'TRASH': '[Gmail]/Trash',
      'starred': '[Gmail]/Starred',
      'important': '[Gmail]/Important',
      'archive': '[Gmail]/All Mail'
    };
    
    return gmailFolderMap[folder.toUpperCase()] || folder;
  }
  
  /**
   * List emails with basic pagination and optional preview content
   * Updated to fetch ALL emails when limit is -1
   */
  async listEmails(
    folder: string = 'INBOX', 
    limit: number = 50,
    offset: number = 0,
    sortOrder: 'asc' | 'desc' = 'desc',
    includePreview: boolean = true
  ): Promise<{ emails: EmailMetadata[]; total: number; hasMore: boolean }> {
    if (!this.connection) {
      throw new ImapConnectionError('Not connected to IMAP server');
    }

    try {
      // Map folder to Gmail path if needed
      const actualFolder = this.getGmailFolderPath(folder);
      console.log(`📁 Opening mailbox: ${folder} -> ${actualFolder}`);
      
      // Open mailbox
      const mailbox = await this.connection.mailboxOpen(actualFolder);
      this.currentFolder = actualFolder;
      
      console.log(`📊 Mailbox info:`, {
        path: mailbox.path,
        flags: mailbox.flags,
        permanentFlags: mailbox.permanentFlags,
        exists: mailbox.exists,
        uidValidity: mailbox.uidValidity,
        uidNext: mailbox.uidNext,
      });

      // Search for all emails
      console.log(`🔍 Searching for all emails in ${folder}...`);
      const search = await this.connection.search({ all: true });
      console.log(`📋 Search result:`, search);
      
      const total = Array.isArray(search) ? search.length : 0;
      console.log(`📊 Total emails found: ${total}`);

      if (total === 0) {
        console.log(`⚠️ No emails found in folder: ${folder}`);
        return { emails: [], total: 0, hasMore: false };
      }

      // Apply pagination - if limit is -1, fetch all emails
      const searchArray = Array.isArray(search) ? search : [];
      const sortedUids = sortOrder === 'desc' ? searchArray.reverse() : searchArray;
      
      let paginatedUids: any[];
      let hasMore: boolean;
      
      if (limit === -1) {
        // Fetch all emails
        paginatedUids = sortedUids;
        hasMore = false;
        console.log(`📄 Fetching ALL emails: ${paginatedUids.length} emails`);
      } else {
        // Apply normal pagination
        paginatedUids = sortedUids.slice(offset, offset + limit);
        hasMore = offset + limit < total;
        console.log(`📄 Pagination: offset=${offset}, limit=${limit}, hasMore=${hasMore}`);
      }
      
      console.log(`📋 UIDs to fetch:`, paginatedUids);

      // Fetch email headers and optionally preview content
      const emails: EmailMetadata[] = [];
      console.log(`📨 Fetching email headers${includePreview ? ' and preview content' : ''}...`);
      
      const fetchOptions: any = {
        envelope: true,
        flags: true,
        size: true,
        uid: true,
      };
      
      // Add bodystructure for preview if needed
      if (includePreview) {
        fetchOptions.bodyStructure = true;
        // Note: We'll fetch body text separately as imapflow doesn't support complex bodyParts syntax
      }
      
      for await (const message of this.connection.fetch(paginatedUids, fetchOptions)) {
        console.log(`📧 Processing message UID: ${message.uid}`);
        const email = await this.parseMessageToMetadata(message, includePreview);
        if (email) {
          emails.push(email);
          console.log(`✅ Parsed email: ${email.subject} from ${email.from}`);
        } else {
          console.log(`⚠️ Failed to parse message UID: ${message.uid}`);
        }
      }

      console.log(`📊 Successfully fetched ${emails.length} emails`);
      return { emails, total, hasMore };

    } catch (error) {
      console.error(`❌ Error listing emails from ${folder}:`, error);
      throw new ImapConnectionError(
        `Failed to list emails from folder ${folder}`,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Get full email message
   */
  async getEmail(uid: string, folder: string = 'INBOX'): Promise<EmailMessage> {
    if (!this.connection) {
      throw new ImapConnectionError('Not connected to IMAP server');
    }

    try {
      // Open mailbox if needed
      if (this.currentFolder !== folder) {
        await this.connection.mailboxOpen(folder);
        this.currentFolder = folder;
      }

      // Fetch full email
      const messages = [];
      for await (const message of this.connection.fetch(`${uid}`, {
        envelope: true,
        flags: true,
        size: true,
        source: true,
        uid: true,
      }, { uid: true })) {
        messages.push(message);
      }

      if (messages.length === 0) {
        throw new EmailNotFoundError(uid);
      }

      const message = messages[0];
      if (!message) {
        throw new EmailNotFoundError(uid);
      }
      
      // Check if message.source exists before parsing
      if (!message.source) {
        throw new EmailNotFoundError(uid);
      }
      
      // Parse email content using mailparser
      const parsed = await simpleParser(message.source);
      const email = await this.parseMessageToEmail(message, parsed);

      // Process and sanitize HTML content
      if (email.htmlBody) {
        email.sanitizedHtml = this.sanitizeHtmlContent(email.htmlBody);
      }

      return email;

    } catch (error) {
      if (error instanceof EmailNotFoundError) {
        throw error;
      }
      throw new ImapConnectionError(
        `Failed to fetch email with UID ${uid}`,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Search emails with advanced query options
   */
  async searchEmails(
    searchQuery: any,
    folder: string = 'INBOX',
    limit: number = 50,
    offset: number = 0
  ): Promise<{ emails: EmailMetadata[]; total: number; hasMore: boolean }> {
    if (!this.connection) {
      throw new ImapConnectionError('Not connected to IMAP server');
    }

    try {
      console.log(`🔍 Searching emails in ${folder} with query:`, searchQuery);
      
      // Open mailbox
      await this.connection.mailboxOpen(folder);
      this.currentFolder = folder;
      
      // Build search criteria
      const searchCriteria = this.buildSearchCriteria(searchQuery);
      console.log('🔍 Search criteria:', searchCriteria);
      
      // Execute search
      const searchResults = await this.connection.search(searchCriteria);
      const total = Array.isArray(searchResults) ? searchResults.length : 0;
      
      console.log(`📊 Search found ${total} matching emails`);
      
      if (total === 0) {
        return { emails: [], total: 0, hasMore: false };
      }

      // Apply pagination
      const searchArray = Array.isArray(searchResults) ? searchResults : [];
      const paginatedUids = searchArray.slice(offset, offset + limit);
      const hasMore = offset + limit < total;
      
      // Fetch email headers
      const emails: EmailMetadata[] = [];
      const fetchOptions = {
        envelope: true,
        flags: true,
        size: true,
        uid: true,
        bodyStructure: true,
      };
      
      for await (const message of this.connection.fetch(paginatedUids, fetchOptions)) {
        const email = await this.parseMessageToMetadata(message, true);
        if (email) {
          emails.push(email);
        }
      }

      console.log(`📊 Successfully fetched ${emails.length} matching emails`);
      return { emails, total, hasMore };

    } catch (error) {
      console.error(`❌ Error searching emails in ${folder}:`, error);
      throw new ImapConnectionError(
        `Failed to search emails in folder ${folder}`,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Build IMAP search criteria from search query
   */
  private buildSearchCriteria(searchQuery: any): any {
    const criteria: any = {};
    
    // Text search (searches subject, body, from, to)
    if (searchQuery.query) {
      criteria.text = searchQuery.query;
    }
    
    // Specific field searches
    if (searchQuery.from) {
      criteria.from = searchQuery.from;
    }
    
    if (searchQuery.to) {
      criteria.to = searchQuery.to;
    }
    
    if (searchQuery.subject) {
      criteria.subject = searchQuery.subject;
    }
    
    if (searchQuery.body) {
      criteria.body = searchQuery.body;
    }
    
    // Date range searches
    if (searchQuery.dateFrom) {
      criteria.since = new Date(searchQuery.dateFrom);
    }
    
    if (searchQuery.dateTo) {
      criteria.before = new Date(searchQuery.dateTo);
    }
    
    // Flag-based searches
    if (searchQuery.isRead === true) {
      criteria.seen = true;
    } else if (searchQuery.isRead === false) {
      criteria.seen = false;
    }
    
    if (searchQuery.hasAttachments === true) {
      // Note: Not all IMAP servers support this, fallback to post-processing
      criteria.keyword = 'attachment';
    }
    
    // Size-based search
    if (searchQuery.size?.min) {
      criteria.larger = searchQuery.size.min;
    }
    
    if (searchQuery.size?.max) {
      criteria.smaller = searchQuery.size.max;
    }
    
    // If no criteria specified, search all
    if (Object.keys(criteria).length === 0) {
      criteria.all = true;
    }
    
    return criteria;
  }

  /**
   * List folders
   */
  async listFolders(): Promise<EmailFolder[]> {
    if (!this.connection) {
      throw new ImapConnectionError('Not connected to IMAP server');
    }

    try {
      console.log('📁 Listing IMAP folders...');
      const list = await this.connection.list();
      console.log(`📂 Found ${list.length} folders:`);
      
      const folders = list.map(item => {
        const folder = {
          name: item.name,
          path: item.path,
          delimiter: item.delimiter || '/',
          flags: Array.from(item.flags || new Set()),
        };
        console.log(`  - ${folder.path} (${folder.name}) [${folder.flags.join(', ')}]`);
        return folder;
      });
      
      return folders;
    } catch (error) {
      console.error('❌ Error listing folders:', error);
      throw new ImapConnectionError(
        'Failed to list folders',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  // Helper methods
  private async parseMessageToMetadata(message: any, includePreview: boolean = false): Promise<EmailMetadata | null> {
    try {
      const envelope = message.envelope;
      if (!envelope) return null;

      // Handle flags as Set or array
      let flagsArr: string[] = [];
      if (Array.isArray(message.flags)) {
        flagsArr = message.flags;
      } else if (message.flags && typeof message.flags === 'object' && typeof message.flags.forEach === 'function') {
        flagsArr = Array.from(message.flags);
      }

      // Extract preview content if available
      let preview = '';
      let hasAttachments = false;
      
      if (includePreview && message.bodyStructure) {
        try {
          // Check for attachments by examining body structure
          hasAttachments = this.hasAttachmentsInStructure(message.bodyStructure);
          
          // Try to extract actual preview content
          preview = await this.extractActualPreview(message.uid, message.bodyStructure);
          
          // Fallback to subject if no preview extracted
          if (!preview) {
            preview = envelope.subject || 'No preview available';
          }
        } catch (previewError) {
          console.warn('Failed to extract preview for UID:', message.uid, previewError);
          // Fallback to subject if preview extraction fails
          preview = envelope.subject || 'No preview available';
        }
      } else {
        // Fallback to subject if no preview extraction
        preview = envelope.subject || 'No preview available';
      }

      const metadata: EmailMetadata = {
        uid: message.uid.toString(),
        subject: envelope.subject || 'No Subject',
        from: this.formatAddress(envelope.from),
        to: this.formatAddress(envelope.to),
        cc: this.formatAddress(envelope.cc),
        bcc: this.formatAddress(envelope.bcc),
        date: envelope.date ? envelope.date.toISOString() : new Date().toISOString(),
        flags: flagsArr,
        size: message.size || 0,
        isRead: flagsArr.includes('\\Seen'),
        hasAttachments,
      };
      
      // Add preview as an additional property (extend the type if needed)
      if (preview) {
        (metadata as any).preview = preview;
      }
      
      return metadata;
    } catch (error) {
      console.warn('Failed to parse message metadata:', error);
      return null;
    }
  }

  private async parseMessageToEmail(message: any, parsed: any): Promise<EmailMessage> {
    const metadata = await this.parseMessageToMetadata(message);
    if (!metadata) {
      throw new Error('Failed to parse message metadata');
    }

    return {
      ...metadata,
      headers: this.convertHeaders(parsed.headers),
      body: parsed.text || parsed.html || '',
      htmlBody: parsed.html || '',
      textBody: parsed.text || '',
      attachments: this.convertAttachments(parsed.attachments),
    };
  }

  private formatAddress(addresses: any): string {
    if (!addresses || !Array.isArray(addresses)) return '';
    return addresses
      .map(addr => {
        if (addr.name) {
          return `${addr.name} <${addr.address}>`;
        }
        return addr.address;
      })
      .join(', ');
  }

  private convertHeaders(headers: any): Record<string, string> {
    const result: Record<string, string> = {};
    if (headers) {
      for (const [key, value] of headers) {
        result[key] = Array.isArray(value) ? value.join(', ') : value;
      }
    }
    return result;
  }

  private convertAttachments(attachments: any[]): EmailAttachment[] {
    if (!attachments) return [];
    
    return attachments.map(att => ({
      filename: att.filename || 'unnamed',
      contentType: att.contentType || 'application/octet-stream',
      size: att.size || 0,
      content: att.content,
      contentId: att.cid || '',
      disposition: att.contentDisposition === 'inline' ? 'inline' : 'attachment',
      encoding: att.transferEncoding || '',
    }));
  }

  private sanitizeHtmlContent(html: string): string {
    return sanitizeHtml(html, {
      allowedTags: [
        'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'span', 'div',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li',
        'a', 'img',
        'table', 'thead', 'tbody', 'tr', 'td', 'th',
        'blockquote', 'pre', 'code'
      ],
      allowedAttributes: {
        'a': ['href', 'title'],
        'img': ['src', 'alt', 'title', 'width', 'height'],
        '*': ['style', 'class']
      },
      allowedSchemes: ['http', 'https', 'mailto'],
    });
  }

  /**
   * Extract actual preview text from email content
   * This fetches a portion of the email body for real content preview
   */
  private async extractActualPreview(uid: string, bodyStructure: any): Promise<string> {
    if (!this.connection || !bodyStructure) return '';
    
    try {
      // Look for text/plain part first, then text/html
      const textPart = this.findTextPart(bodyStructure, 'plain') || this.findTextPart(bodyStructure, 'html');
      
      if (textPart) {
        // Fetch the specific body part
        const bodyContent = await this.connection.download(uid, textPart, { uid: true });
        const content = bodyContent.toString();
        
        // Clean and extract preview
        let preview = content;
        
        // If it's HTML, strip tags
        if (textPart.includes('TEXT')) {
          preview = this.stripHtmlTags(content);
        }
        
        // Clean whitespace and get first 150 characters
        preview = preview
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 150);
          
        return preview || '';
      }
      
      return this.extractPreviewFromBodyStructure(bodyStructure);
    } catch (error) {
      console.warn('Error extracting actual preview:', error);
      return this.extractPreviewFromBodyStructure(bodyStructure);
    }
  }

  /**
   * Find text part in body structure
   */
  private findTextPart(bodyStructure: any, subtype: 'plain' | 'html'): string | null {
    if (!bodyStructure) return null;
    
    // For multipart messages
    if (Array.isArray(bodyStructure)) {
      for (let i = 0; i < bodyStructure.length; i++) {
        const result = this.findTextPart(bodyStructure[i], subtype);
        if (result) return result;
      }
      return null;
    }
    
    // Check if this part matches what we're looking for
    const type = bodyStructure.type?.toLowerCase();
    const partSubtype = bodyStructure.subtype?.toLowerCase();
    
    if (type === 'text' && partSubtype === subtype) {
      // Return the body part identifier
      return `TEXT`; // Simplified - in real implementation you'd return proper IMAP body part ID
    }
    
    return null;
  }

  /**
   * Strip HTML tags for plain text preview
   */
  private stripHtmlTags(html: string): string {
    return html
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
      .replace(/&lt;/g, '<')  // Replace HTML entities
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  /**
   * Extract preview text from email body structure (fallback)
   * This is a simplified approach that creates preview based on structure info
   */
  private extractPreviewFromBodyStructure(bodyStructure: any): string {
    if (!bodyStructure) return '';
    
    try {
      // For multipart emails, look for text parts
      if (Array.isArray(bodyStructure)) {
        for (const part of bodyStructure) {
          const preview = this.extractPreviewFromBodyStructure(part);
          if (preview) return preview;
        }
        return '';
      }
      
      // Check if this is a text part
      const type = bodyStructure.type?.toLowerCase();
      const subtype = bodyStructure.subtype?.toLowerCase();
      
      if (type === 'text' && (subtype === 'plain' || subtype === 'html')) {
        // Generate a preview based on content type
        if (subtype === 'plain') {
          return 'Text message...';
        } else if (subtype === 'html') {
          return 'HTML message...';
        }
      }
      
      // For other content types, return descriptive text
      if (type === 'image') {
        return `Image: ${bodyStructure.subtype || 'unknown'}`;
      } else if (type === 'application') {
        return `Attachment: ${bodyStructure.subtype || 'unknown'}`;
      }
      
      return '';
    } catch (error) {
      console.warn('Error extracting preview from body structure:', error);
      return '';
    }
  }

  private hasAttachmentsInStructure(bodyStructure: any): boolean {
    if (!bodyStructure) return false;
    
    try {
      // Check if it's a multipart message
      if (Array.isArray(bodyStructure)) {
        // Multipart message - check each part
        return bodyStructure.some(part => this.hasAttachmentsInStructure(part));
      }
      
      // Single part - check if it's an attachment
      if (bodyStructure.disposition) {
        return bodyStructure.disposition.type === 'attachment';
      }
      
      // Check for common attachment MIME types
      const type = bodyStructure.type?.toLowerCase();
      const subtype = bodyStructure.subtype?.toLowerCase();
      
      if (type === 'application' || type === 'image' || type === 'audio' || type === 'video') {
        return true;
      }
      
      // Check for specific subtypes that might be attachments
      if (type === 'text' && subtype && ['csv', 'xml'].includes(subtype)) {
        return true;
      }
      
      // Check for text/html or text/plain that might be attachments
      if (type === 'text' && bodyStructure.disposition?.type === 'attachment') {
        return true;
      }
      
      return false;
    } catch (error) {
      console.warn('Error checking for attachments in body structure:', error);
      return false;
    }
  }

  /**
   * Perform email operations (mark read/unread, star, delete, move, etc.)
   */
  async performEmailOperation(
    operation: any,
    folder: string = 'INBOX'
  ): Promise<{ success: boolean; processed: number; error?: string }> {
    if (!this.connection) {
      throw new ImapConnectionError('Not connected to IMAP server');
    }

    try {
      // Open mailbox if needed
      if (this.currentFolder !== folder) {
        await this.connection.mailboxOpen(folder);
        this.currentFolder = folder;
      }

      const { type, uids } = operation;
      const uidArray = Array.isArray(uids) ? uids : [uids];
      let processed = 0;

      console.log(`🔧 Performing operation '${type}' on ${uidArray.length} emails`);

      switch (type) {
        case 'mark_read':
          for (const uid of uidArray) {
            await this.connection.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
            processed++;
          }
          break;

        case 'mark_unread':
          for (const uid of uidArray) {
            await this.connection.messageFlagsRemove(uid, ['\\Seen'], { uid: true });
            processed++;
          }
          break;

        case 'star':
          for (const uid of uidArray) {
            await this.connection.messageFlagsAdd(uid, ['\\Flagged'], { uid: true });
            processed++;
          }
          break;

        case 'unstar':
          for (const uid of uidArray) {
            await this.connection.messageFlagsRemove(uid, ['\\Flagged'], { uid: true });
            processed++;
          }
          break;

        case 'delete':
          for (const uid of uidArray) {
            await this.connection.messageFlagsAdd(uid, ['\\Deleted'], { uid: true });
            processed++;
          }
          // Expunge to permanently delete
          await this.connection.mailboxClose();
          await this.connection.mailboxOpen(folder);
          break;

        case 'move':
          if (!operation.targetFolder) {
            throw new Error('Target folder is required for move operation');
          }
          for (const uid of uidArray) {
            await this.connection.messageMove(uid, operation.targetFolder, { uid: true });
            processed++;
          }
          break;

        case 'copy':
          if (!operation.targetFolder) {
            throw new Error('Target folder is required for copy operation');
          }
          for (const uid of uidArray) {
            await this.connection.messageCopy(uid, operation.targetFolder, { uid: true });
            processed++;
          }
          break;

        case 'add_label':
          // Note: Label support varies by IMAP server (Gmail uses labels)
          if (!operation.labels || !Array.isArray(operation.labels)) {
            throw new Error('Labels are required for add_label operation');
          }
          for (const uid of uidArray) {
            await this.connection.messageFlagsAdd(uid, operation.labels, { uid: true });
            processed++;
          }
          break;

        case 'remove_label':
          if (!operation.labels || !Array.isArray(operation.labels)) {
            throw new Error('Labels are required for remove_label operation');
          }
          for (const uid of uidArray) {
            await this.connection.messageFlagsRemove(uid, operation.labels, { uid: true });
            processed++;
          }
          break;

        default:
          throw new Error(`Unsupported operation: ${type}`);
      }

      console.log(`✅ Successfully processed ${processed} emails with operation '${type}'`);
      return { success: true, processed };

    } catch (error) {
      console.error(`❌ Error performing operation '${operation.type}':`, error);
      return {
        success: false,
        processed: 0,
        error: error instanceof Error ? error.message : 'Operation failed',
      };
    }
  }

  /**
   * Get folder information (unread count, total count)
   */
  async getFolderInfo(folder: string = 'INBOX'): Promise<{ 
    name: string; 
    path: string; 
    unreadCount: number; 
    totalCount: number; 
    flags: string[] 
  }> {
    if (!this.connection) {
      throw new ImapConnectionError('Not connected to IMAP server');
    }

    try {
      console.log(`📊 Getting folder info for: ${folder}`);
      
      const mailbox = await this.connection.mailboxOpen(folder);
      this.currentFolder = folder;
      
      // Get unread count
      const unreadSearch = await this.connection.search({ seen: false });
      const unreadCount = Array.isArray(unreadSearch) ? unreadSearch.length : 0;
      
      const folderInfo = {
        name: folder.split('/').pop() || folder,
        path: folder,
        unreadCount,
        totalCount: mailbox.exists,
        flags: Array.from(mailbox.flags || []),
      };
      
      console.log(`📊 Folder '${folder}' - ${folderInfo.totalCount} total, ${folderInfo.unreadCount} unread`);
      return folderInfo;
      
    } catch (error) {
      console.error(`❌ Error getting folder info for '${folder}':`, error);
      throw new ImapConnectionError(
        `Failed to get folder info for '${folder}'`,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Create a new folder
   */
  async createFolder(folderPath: string): Promise<boolean> {
    if (!this.connection) {
      throw new ImapConnectionError('Not connected to IMAP server');
    }

    try {
      console.log(`📁 Creating folder: ${folderPath}`);
      await this.connection.mailboxCreate(folderPath);
      console.log(`✅ Successfully created folder: ${folderPath}`);
      return true;
    } catch (error) {
      console.error(`❌ Error creating folder '${folderPath}':`, error);
      throw new ImapConnectionError(
        `Failed to create folder '${folderPath}'`,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Delete a folder
   */
  async deleteFolder(folderPath: string): Promise<boolean> {
    if (!this.connection) {
      throw new ImapConnectionError('Not connected to IMAP server');
    }

    try {
      console.log(`🗑️ Deleting folder: ${folderPath}`);
      await this.connection.mailboxDelete(folderPath);
      console.log(`✅ Successfully deleted folder: ${folderPath}`);
      return true;
    } catch (error) {
      console.error(`❌ Error deleting folder '${folderPath}':`, error);
      throw new ImapConnectionError(
        `Failed to delete folder '${folderPath}'`,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Rename a folder
   */
  async renameFolder(oldPath: string, newPath: string): Promise<boolean> {
    if (!this.connection) {
      throw new ImapConnectionError('Not connected to IMAP server');
    }

    try {
      console.log(`📝 Renaming folder from '${oldPath}' to '${newPath}'`);
      await this.connection.mailboxRename(oldPath, newPath);
      console.log(`✅ Successfully renamed folder from '${oldPath}' to '${newPath}'`);
      return true;
    } catch (error) {
      console.error(`❌ Error renaming folder from '${oldPath}' to '${newPath}':`, error);
      throw new ImapConnectionError(
        `Failed to rename folder from '${oldPath}' to '${newPath}'`,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }
}
