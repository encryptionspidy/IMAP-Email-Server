import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { 
  Email, 
  EmailFolder, 
  EmailFilter, 
  EmailComposition, 
  EmailTemplate, 
  EmailAccount, 
  EmailClientSettings,
  EmailLabel,
  EmailThread
} from '../types/email';

interface EmailState {
  // Current state
  emails: Email[];
  folders: EmailFolder[];
  labels: EmailLabel[];
  threads: EmailThread[];
  currentEmail: Email | null;
  currentFolder: string;
  selectedEmails: string[];
  searchQuery: string;
  activeFilter: EmailFilter;
  
  // UI state
  isLoading: boolean;
  isSidebarOpen: boolean;
  isComposeOpen: boolean;
  isSearching: boolean;
  viewMode: 'list' | 'cards' | 'compact';
  sortBy: 'date' | 'subject' | 'from' | 'size';
  sortOrder: 'asc' | 'desc';
  
  // Composition
  composition: EmailComposition;
  templates: EmailTemplate[];
  
  // Settings
  settings: EmailClientSettings;
  account: EmailAccount | null;
  
  // Pagination
  currentPage: number;
  hasMore: boolean;
  
  // Actions
  setEmails: (emails: Email[]) => void;
  addEmails: (emails: Email[]) => void;
  updateEmail: (id: string, updates: Partial<Email>) => void;
  deleteEmail: (id: string) => void;
  
  setFolders: (folders: EmailFolder[]) => void;
  setLabels: (labels: EmailLabel[]) => void;
  setThreads: (threads: EmailThread[]) => void;
  
  setCurrentEmail: (email: Email | null) => void;
  setCurrentFolder: (folder: string) => void;
  setSelectedEmails: (emails: string[]) => void;
  toggleEmailSelection: (emailId: string) => void;
  selectAllEmails: () => void;
  clearSelection: () => void;
  
  setSearchQuery: (query: string) => void;
  setActiveFilter: (filter: EmailFilter) => void;
  clearFilter: () => void;
  
  setLoading: (loading: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  setComposeOpen: (open: boolean) => void;
  setSearching: (searching: boolean) => void;
  setViewMode: (mode: 'list' | 'cards' | 'compact') => void;
  setSorting: (sortBy: 'date' | 'subject' | 'from' | 'size', sortOrder: 'asc' | 'desc') => void;
  
  setComposition: (composition: Partial<EmailComposition>) => void;
  resetComposition: () => void;
  setTemplates: (templates: EmailTemplate[]) => void;
  
  setSettings: (settings: Partial<EmailClientSettings>) => void;
  setAccount: (account: EmailAccount | null) => void;
  resetEmailConfig: () => void;
  
  setCurrentPage: (page: number) => void;
  setHasMore: (hasMore: boolean) => void;
  
  // Bulk operations
  markAsRead: (emailIds: string[]) => void;
  markAsUnread: (emailIds: string[]) => void;
  toggleStar: (emailIds: string[]) => void;
  moveToFolder: (emailIds: string[], folder: string) => void;
  addLabel: (emailIds: string[], label: string) => void;
  removeLabel: (emailIds: string[], label: string) => void;
  archiveEmails: (emailIds: string[]) => void;
  deleteEmails: (emailIds: string[]) => void;
  
  // Utility
  getUnreadCount: () => number;
  getEmailsByFolder: (folder: string) => Email[];
  getEmailsByLabel: (label: string) => Email[];
  getFilteredEmails: () => Email[];
}

const defaultComposition: EmailComposition = {
  to: [],
  cc: [],
  bcc: [],
  subject: '',
  body: '',
  attachments: [],
};

const defaultSettings: EmailClientSettings = {
  theme: 'light',
  language: 'en',
  timezone: 'UTC',
  emailsPerPage: 50,
  autoMarkAsRead: true,
  showPreview: true,
  enableNotifications: true,
  playSound: false,
  keyboardShortcuts: [],
  signature: '',
  defaultFontSize: 14,
  compactView: false,
  rightToLeft: false,
};

const defaultFilter: EmailFilter = {};

export const useEmailStore = create<EmailState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        emails: [],
        folders: [],
        labels: [],
        threads: [],
        currentEmail: null,
        currentFolder: 'INBOX',
        selectedEmails: [],
        searchQuery: '',
        activeFilter: defaultFilter,
        
        isLoading: false,
        isSidebarOpen: true,
        isComposeOpen: false,
        isSearching: false,
        viewMode: 'list',
        sortBy: 'date',
        sortOrder: 'desc',
        
        composition: defaultComposition,
        templates: [],
        
        settings: defaultSettings,
        account: null,
        
        currentPage: 1,
        hasMore: true,
        
        // Actions
        setEmails: (emails) => set({ emails }),
        
        addEmails: (emails) => set((state) => ({
          emails: [...state.emails, ...emails]
        })),
        
        updateEmail: (id, updates) => set((state) => ({
          emails: state.emails.map(email => 
            email.id === id ? { ...email, ...updates } : email
          )
        })),
        
        deleteEmail: (id) => set((state) => ({
          emails: state.emails.filter(email => email.id !== id),
          selectedEmails: state.selectedEmails.filter(emailId => emailId !== id)
        })),
        
        setFolders: (folders) => set({ folders }),
        setLabels: (labels) => set({ labels }),
        setThreads: (threads) => set({ threads }),
        
        setCurrentEmail: (email) => set({ currentEmail: email }),
        setCurrentFolder: (folder) => set({ currentFolder: folder }),
        setSelectedEmails: (emails) => set({ selectedEmails: emails }),
        
        toggleEmailSelection: (emailId) => set((state) => ({
          selectedEmails: state.selectedEmails.includes(emailId)
            ? state.selectedEmails.filter(id => id !== emailId)
            : [...state.selectedEmails, emailId]
        })),
        
        selectAllEmails: () => set((state) => ({
          selectedEmails: state.emails.map(email => email.id)
        })),
        
        clearSelection: () => set({ selectedEmails: [] }),
        
        setSearchQuery: (query) => set({ searchQuery: query }),
        setActiveFilter: (filter) => set({ activeFilter: filter }),
        clearFilter: () => set({ activeFilter: defaultFilter }),
        
        setLoading: (loading) => set({ isLoading: loading }),
        setSidebarOpen: (open) => set({ isSidebarOpen: open }),
        setComposeOpen: (open) => set({ isComposeOpen: open }),
        setSearching: (searching) => set({ isSearching: searching }),
        setViewMode: (mode) => set({ viewMode: mode }),
        setSorting: (sortBy, sortOrder) => set({ sortBy, sortOrder }),
        
        setComposition: (updates) => set((state) => ({
          composition: { ...state.composition, ...updates }
        })),
        
        resetComposition: () => set({ composition: defaultComposition }),
        setTemplates: (templates) => set({ templates }),
        
        setSettings: (updates) => set((state) => ({
          settings: { ...state.settings, ...updates }
        })),
        
        setAccount: (account) => set({ account }),
        
        resetEmailConfig: () => {
          // Clear all email-related data and configuration
          sessionStorage.removeItem('imapConfig');
          set({
            account: null,
            emails: [],
            currentEmail: null,
            selectedEmails: [],
            searchQuery: '',
            activeFilter: defaultFilter,
            currentPage: 1,
            hasMore: true,
          });
        },
        
        setCurrentPage: (page) => set({ currentPage: page }),
        setHasMore: (hasMore) => set({ hasMore }),
        
        // Bulk operations
        markAsRead: (emailIds) => set((state) => ({
          emails: state.emails.map(email =>
            emailIds.includes(email.id) ? { ...email, isRead: true } : email
          )
        })),
        
        markAsUnread: (emailIds) => set((state) => ({
          emails: state.emails.map(email =>
            emailIds.includes(email.id) ? { ...email, isRead: false } : email
          )
        })),
        
        toggleStar: (emailIds) => set((state) => ({
          emails: state.emails.map(email =>
            emailIds.includes(email.id) ? { ...email, isStarred: !email.isStarred } : email
          )
        })),
        
        moveToFolder: (emailIds, folder) => set((state) => ({
          emails: state.emails.map(email =>
            emailIds.includes(email.id) ? { ...email, folder } : email
          )
        })),
        
        addLabel: (emailIds, label) => set((state) => ({
          emails: state.emails.map(email =>
            emailIds.includes(email.id) && !email.labels.includes(label)
              ? { ...email, labels: [...email.labels, label] }
              : email
          )
        })),
        
        removeLabel: (emailIds, label) => set((state) => ({
          emails: state.emails.map(email =>
            emailIds.includes(email.id)
              ? { ...email, labels: email.labels.filter(l => l !== label) }
              : email
          )
        })),
        
        archiveEmails: (emailIds) => set((state) => ({
          emails: state.emails.filter(email => !emailIds.includes(email.id))
        })),
        
        deleteEmails: (emailIds) => set((state) => ({
          emails: state.emails.filter(email => !emailIds.includes(email.id)),
          selectedEmails: state.selectedEmails.filter(id => !emailIds.includes(id))
        })),
        
        // Utility functions
        getUnreadCount: () => {
          const state = get();
          return state.emails.filter(email => !email.isRead).length;
        },
        
        getEmailsByFolder: (folder) => {
          const state = get();
          return state.emails.filter(email => email.folder === folder);
        },
        
        getEmailsByLabel: (label) => {
          const state = get();
          return state.emails.filter(email => email.labels.includes(label));
        },
        
        getFilteredEmails: () => {
          const state = get();
          let filteredEmails = state.emails;
          
          // Apply folder filter
          if (state.currentFolder !== 'all') {
            filteredEmails = filteredEmails.filter(email => email.folder === state.currentFolder);
          }
          
          // Apply search query
          if (state.searchQuery) {
            const query = state.searchQuery.toLowerCase();
            filteredEmails = filteredEmails.filter(email =>
              email.subject.toLowerCase().includes(query) ||
              email.from.address.toLowerCase().includes(query) ||
              email.from.name?.toLowerCase().includes(query) ||
              email.body.text?.toLowerCase().includes(query)
            );
          }
          
          // Apply active filter
          const filter = state.activeFilter;
          if (filter.from) {
            filteredEmails = filteredEmails.filter(email =>
              email.from.address.toLowerCase().includes(filter.from!.toLowerCase())
            );
          }
          if (filter.subject) {
            filteredEmails = filteredEmails.filter(email =>
              email.subject.toLowerCase().includes(filter.subject!.toLowerCase())
            );
          }
          if (filter.isUnread !== undefined) {
            filteredEmails = filteredEmails.filter(email => !email.isRead === filter.isUnread);
          }
          if (filter.isStarred !== undefined) {
            filteredEmails = filteredEmails.filter(email => email.isStarred === filter.isStarred);
          }
          if (filter.hasAttachments !== undefined) {
            filteredEmails = filteredEmails.filter(email => email.hasAttachments === filter.hasAttachments);
          }
          if (filter.labels && filter.labels.length > 0) {
            filteredEmails = filteredEmails.filter(email =>
              filter.labels!.some(label => email.labels.includes(label))
            );
          }
          
          // Apply sorting
          filteredEmails.sort((a, b) => {
            let comparison = 0;
            
            switch (state.sortBy) {
              case 'date':
                comparison = a.date.getTime() - b.date.getTime();
                break;
              case 'subject':
                comparison = a.subject.localeCompare(b.subject);
                break;
              case 'from':
                comparison = a.from.address.localeCompare(b.from.address);
                break;
              case 'size':
                comparison = a.size - b.size;
                break;
            }
            
            return state.sortOrder === 'desc' ? -comparison : comparison;
          });
          
          return filteredEmails;
        },
      }),
      {
        name: 'email-client-storage',
        partialize: (state) => ({
          settings: state.settings,
          account: state.account,
          viewMode: state.viewMode,
          sortBy: state.sortBy,
          sortOrder: state.sortOrder,
          isSidebarOpen: state.isSidebarOpen,
        }),
        // Initialize account from sessionStorage on load
        onRehydrateStorage: () => (state) => {
          if (state) {
            const storedConfig = sessionStorage.getItem('imapConfig');
            if (storedConfig) {
              try {
                const config = JSON.parse(storedConfig);
                // Always update account from sessionStorage if config exists
                state.account = {
                  id: '1',
                  name: 'Connected Account',
                  email: config.username,
                  provider: config.host.includes('gmail') ? 'Gmail' : 'IMAP',
                  isConnected: true,
                  settings: {
                    imapHost: config.host,
                    imapPort: config.port,
                    smtpHost: config.host.replace('imap', 'smtp'),
                    smtpPort: 587,
                    useSSL: config.tls
                  }
                };
              } catch (error) {
                console.warn('Failed to restore account from sessionStorage:', error);
                // Clear invalid sessionStorage data
                sessionStorage.removeItem('imapConfig');
                state.account = null;
              }
            } else {
              // No sessionStorage config, ensure account is null
              state.account = null;
            }
          }
        },
      }
    )
  )
);
