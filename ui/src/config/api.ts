// API configuration for different environments
const AWS_ENDPOINT = (import.meta as any).env?.VITE_BACKEND_API_URL || 'https://zbwddyowtg.execute-api.ap-south-1.amazonaws.com/dev';
const API_TIMEOUT = parseInt((import.meta as any).env?.VITE_TIMEOUT || '30000');

export const API_CONFIG = {
  // For development, we use direct AWS Lambda endpoint
  development: {
    baseURL: AWS_ENDPOINT,
    timeout: API_TIMEOUT,
  },
  production: {
    baseURL: AWS_ENDPOINT,
    timeout: API_TIMEOUT,
  }
};

// Get current environment
const isDevelopment = (import.meta as any).env?.DEV || false;
export const currentConfig = isDevelopment ? API_CONFIG.development : API_CONFIG.production;

// AWS Lambda endpoint (for reference)
export const AWS_API_ENDPOINT = 'https://zbwddyowtg.execute-api.ap-south-1.amazonaws.com/dev';

// Helper function to get full API URL
export const getApiUrl = (path: string): string => {
  return `${currentConfig.baseURL}${path.startsWith('/') ? path : `/${path}`}`;
};

// Default headers for API requests
export const getDefaultHeaders = (): HeadersInit => ({
  'Content-Type': 'application/json',
  'Accept': 'application/json',
});

// Helper function for making API requests with error handling
export const apiRequest = async (
  url: string,
  options: RequestInit = {}
): Promise<Response> => {
  const fullUrl = url.startsWith('http') ? url : getApiUrl(url);
  
  const defaultOptions: RequestInit = {
    headers: getDefaultHeaders(),
    ...options,
  };

  try {
    const response = await fetch(fullUrl, defaultOptions);
    return response;
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
};
