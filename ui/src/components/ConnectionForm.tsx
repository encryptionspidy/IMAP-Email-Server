import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EnvelopeIcon as MailIcon, LockClosedIcon, ServerIcon, UserIcon } from '@heroicons/react/24/outline'
import { useEmailStore } from '../stores/emailStore'
import { getApiUrl } from '../config/api'
import toast from 'react-hot-toast'

interface ConnectionConfig {
  host: string
  port: number
  tls: boolean
  username: string
  password: string
}

export default function ConnectionForm() {
  const navigate = useNavigate()
  const { setAccount } = useEmailStore()
  const [config, setConfig] = useState<ConnectionConfig>({
    host: '',
    port: 993,
    tls: true,
    username: '',
    password: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch(getApiUrl('/emails/list'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...config,
          folder: 'INBOX',
          limit: 1  // Just test connection, don't need many emails
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to connect')
      }

      // Store the configuration and set account state
      sessionStorage.setItem('imapConfig', JSON.stringify(config))
      setAccount({
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
      })
      
      toast.success('Connected successfully!')
      navigate('/inbox')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed')
    } finally {
      setLoading(false)
    }
  }

  const validateField = (field: keyof ConnectionConfig, value: string | number) => {
    const errors = { ...validationErrors }
    
    switch (field) {
      case 'host':
        if (!value || value.toString().trim() === '') {
          errors.host = 'Host is required'
        } else {
          delete errors.host
        }
        break
      case 'username':
        if (!value || value.toString().trim() === '') {
          errors.username = 'Username is required'
        } else {
          delete errors.username
        }
        break
      case 'password':
        if (!value || value.toString().trim() === '') {
          errors.password = 'Password is required'
        } else {
          delete errors.password
        }
        break
      case 'port':
        if (!value || (typeof value === 'number' && (value < 1 || value > 65535))) {
          errors.port = 'Port must be between 1 and 65535'
        } else {
          delete errors.port
        }
        break
    }
    
    setValidationErrors(errors)
  }

  const handleInputChangeWithValidation = (field: keyof ConnectionConfig, value: string | number | boolean) => {
    setConfig(prev => ({ ...prev, [field]: value }))
    if (typeof value !== 'boolean') {
      validateField(field, value)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl brand-text text-slate-900 dark:text-white mb-3">Inboxly</h1>
          <p className="text-slate-600 dark:text-slate-400 text-lg">Connect to your email server</p>
        </div>

        {/* Main Card */}
        <div className="card card-hover shadow-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <div className="px-8 py-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Host Field */}
              <div>
                <label htmlFor="host" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  IMAP Server Host
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <ServerIcon className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                  </div>
                  <input
                    type="text"
                    id="host"
                    required
                    value={config.host}
                    onChange={(e) => handleInputChangeWithValidation('host', e.target.value)}
                    onBlur={(e) => validateField('host', e.target.value)}
                    placeholder="imap.gmail.com"
                    className={`block w-full pl-10 pr-3 py-3 border rounded-lg shadow-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                      validationErrors.host 
                        ? 'border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-500' 
                        : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 hover:border-slate-400 dark:hover:border-slate-500'
                    } dark:text-white`}
                  />
                </div>
                {validationErrors.host && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{validationErrors.host}</p>
                )}
              </div>

              {/* Port Field */}
              <div>
                <label htmlFor="port" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Port
                </label>
                <input
                  type="number"
                  id="port"
                  required
                  value={config.port}
                  onChange={(e) => handleInputChangeWithValidation('port', parseInt(e.target.value) || 0)}
                  onBlur={(e) => validateField('port', parseInt(e.target.value) || 0)}
                  className={`block w-full px-3 py-3 border rounded-lg shadow-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                    validationErrors.port 
                      ? 'border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-500' 
                      : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 hover:border-slate-400 dark:hover:border-slate-500'
                  } dark:text-white`}
                />
                {validationErrors.port && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{validationErrors.port}</p>
                )}
              </div>

              {/* TLS Field */}
              <div className="flex items-center p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                <input
                  type="checkbox"
                  id="tls"
                  checked={config.tls}
                  onChange={(e) => handleInputChangeWithValidation('tls', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-600 rounded transition-colors"
                />
                <label htmlFor="tls" className="ml-3 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  <span className="flex items-center">
                    <LockClosedIcon className="h-4 w-4 mr-2 text-blue-500" />
                    Use TLS/SSL (Recommended)
                  </span>
                </label>
              </div>

              {/* Username Field */}
              <div>
                <label htmlFor="username" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <UserIcon className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="email"
                    id="username"
                    required
                    value={config.username}
                    onChange={(e) => handleInputChangeWithValidation('username', e.target.value)}
                    onBlur={(e) => validateField('username', e.target.value)}
                    placeholder="user@example.com"
                    className={`block w-full pl-10 pr-3 py-3 border rounded-lg shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                      validationErrors.username 
                        ? 'border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-500' 
                        : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 hover:border-slate-400 dark:hover:border-slate-500'
                    } dark:text-white dark:placeholder-slate-400`}
                  />
                </div>
                {validationErrors.username && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{validationErrors.username}</p>
                )}
              </div>

              {/* Password Field */}
              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <LockClosedIcon className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="password"
                    id="password"
                    required
                    value={config.password}
                    onChange={(e) => handleInputChangeWithValidation('password', e.target.value)}
                    onBlur={(e) => validateField('password', e.target.value)}
                    placeholder="Enter your password"
                    className={`block w-full pl-10 pr-3 py-3 border rounded-lg shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                      validationErrors.password 
                        ? 'border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-500' 
                        : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 hover:border-slate-400 dark:hover:border-slate-500'
                    } dark:text-white dark:placeholder-slate-400`}
                  />
                </div>
                {validationErrors.password && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{validationErrors.password}</p>
                )}
              </div>

              {/* Error Display */}
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || Object.keys(validationErrors).length > 0}
                className={`w-full flex items-center justify-center bg-[#1a73e8] hover:bg-[#1765c1] text-white font-semibold py-3 px-4 rounded-lg shadow transition-colors duration-150 mt-4 disabled:opacity-60 disabled:cursor-not-allowed dark:bg-[#1a73e8] dark:hover:bg-[#1765c1]`}
              >
                {loading ? (
                  <span>Connecting...</span>
                ) : (
                  <>
                    <span>Connect to Inbox</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Secure connection to your email server
          </p>
        </div>
      </div>
    </div>
  )
} 
