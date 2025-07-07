import React, { useState } from 'react';
import { useEmailStore } from '../stores/emailStore';
import { 
  CogIcon, 
  XMarkIcon,
  SunIcon,
  MoonIcon,
  ComputerDesktopIcon,
  BellIcon,
  EyeIcon,
  CommandLineIcon,
  UserIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import toast from 'react-hot-toast';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
  const { settings, setSettings, account } = useEmailStore();
  const [activeTab, setActiveTab] = useState<'general' | 'appearance' | 'notifications' | 'keyboard' | 'account'>('general');
  
  const tabs = [
    { id: 'general', label: 'General', icon: CogIcon },
    { id: 'appearance', label: 'Appearance', icon: EyeIcon },
    { id: 'notifications', label: 'Notifications', icon: BellIcon },
    { id: 'keyboard', label: 'Keyboard', icon: CommandLineIcon },
    { id: 'account', label: 'Account', icon: UserIcon },
  ] as const;

  const handleSettingChange = (key: string, value: any) => {
    setSettings({ [key]: value });
    toast.success('Settings updated');
  };

  const themeOptions = [
    { value: 'light', label: 'Light', icon: SunIcon },
    { value: 'dark', label: 'Dark', icon: MoonIcon },
    { value: 'system', label: 'System', icon: ComputerDesktopIcon },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="relative ml-auto w-full max-w-md bg-white dark:bg-gray-800 shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Settings
              </h2>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <XMarkIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            <div className="flex h-full">
              {/* Tabs */}
              <div className="w-32 flex-shrink-0 bg-gray-50 dark:bg-gray-700/50 border-r border-gray-200 dark:border-gray-700">
                <div className="p-2 space-y-1">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={clsx(
                          'w-full flex flex-col items-center p-3 rounded-lg text-xs font-medium transition-colors',
                          activeTab === tab.id
                            ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
                        )}
                      >
                        <Icon className="h-5 w-5 mb-1" />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-4 space-y-6">
                  {activeTab === 'general' && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        General Settings
                      </h3>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Emails per page
                        </label>
                        <select
                          value={settings.emailsPerPage}
                          onChange={(e) => handleSettingChange('emailsPerPage', parseInt(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        >
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Language
                        </label>
                        <select
                          value={settings.language}
                          onChange={(e) => handleSettingChange('language', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        >
                          <option value="en">English</option>
                          <option value="es">Español</option>
                          <option value="fr">Français</option>
                          <option value="de">Deutsch</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Auto-mark as read
                        </span>
                        <button
                          onClick={() => handleSettingChange('autoMarkAsRead', !settings.autoMarkAsRead)}
                          className={clsx(
                            'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                            settings.autoMarkAsRead ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
                          )}
                        >
                          <span
                            className={clsx(
                              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                              settings.autoMarkAsRead ? 'translate-x-5' : 'translate-x-0'
                            )}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Show preview
                        </span>
                        <button
                          onClick={() => handleSettingChange('showPreview', !settings.showPreview)}
                          className={clsx(
                            'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                            settings.showPreview ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
                          )}
                        >
                          <span
                            className={clsx(
                              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                              settings.showPreview ? 'translate-x-5' : 'translate-x-0'
                            )}
                          />
                        </button>
                      </div>
                    </div>
                  )}

                  {activeTab === 'appearance' && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Appearance
                      </h3>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                          Theme
                        </label>
                        <div className="grid grid-cols-1 gap-2">
                          {themeOptions.map((option) => {
                            const Icon = option.icon;
                            return (
                              <button
                                key={option.value}
                                onClick={() => handleSettingChange('theme', option.value)}
                                className={clsx(
                                  'flex items-center p-3 rounded-lg border transition-colors',
                                  settings.theme === option.value
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                    : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                                )}
                              >
                                <Icon className="h-5 w-5 mr-3 text-gray-500 dark:text-gray-400" />
                                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                  {option.label}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Font size
                        </label>
                        <input
                          type="range"
                          min="12"
                          max="18"
                          value={settings.defaultFontSize}
                          onChange={(e) => handleSettingChange('defaultFontSize', parseInt(e.target.value))}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                          <span>Small</span>
                          <span>Large</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Compact view
                        </span>
                        <button
                          onClick={() => handleSettingChange('compactView', !settings.compactView)}
                          className={clsx(
                            'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                            settings.compactView ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
                          )}
                        >
                          <span
                            className={clsx(
                              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                              settings.compactView ? 'translate-x-5' : 'translate-x-0'
                            )}
                          />
                        </button>
                      </div>
                    </div>
                  )}

                  {activeTab === 'notifications' && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Notifications
                      </h3>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Enable notifications
                        </span>
                        <button
                          onClick={() => handleSettingChange('enableNotifications', !settings.enableNotifications)}
                          className={clsx(
                            'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                            settings.enableNotifications ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
                          )}
                        >
                          <span
                            className={clsx(
                              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                              settings.enableNotifications ? 'translate-x-5' : 'translate-x-0'
                            )}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Play sound
                        </span>
                        <button
                          onClick={() => handleSettingChange('playSound', !settings.playSound)}
                          className={clsx(
                            'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                            settings.playSound ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
                          )}
                        >
                          <span
                            className={clsx(
                              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                              settings.playSound ? 'translate-x-5' : 'translate-x-0'
                            )}
                          />
                        </button>
                      </div>
                    </div>
                  )}

                  {activeTab === 'account' && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Account Information
                      </h3>
                      
                      {account && (
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-3">
                          <div className="flex items-center">
                            <ShieldCheckIcon className="h-5 w-5 text-green-500 mr-2" />
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              Connected
                            </span>
                          </div>
                          
                          <div>
                            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                              Email
                            </div>
                            <div className="text-sm text-gray-900 dark:text-gray-100">
                              {account.email}
                            </div>
                          </div>
                          
                          <div>
                            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                              Provider
                            </div>
                            <div className="text-sm text-gray-900 dark:text-gray-100">
                              {account.provider}
                            </div>
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Email signature
                        </label>
                        <textarea
                          value={settings.signature}
                          onChange={(e) => handleSettingChange('signature', e.target.value)}
                          rows={4}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          placeholder="Your email signature..."
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default SettingsPanel;
