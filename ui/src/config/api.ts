// API configuration for different environments
export const API_CONFIG = {
  // For development, we use Vite proxy which forwards to AWS
  // For production, you could build with direct AWS URLs
  development: {
    baseURL: '/api', // Proxied through Vite to AWS
    timeout: 30000,
  },
  production: {
    baseURL: '/api', // Could be changed to direct AWS URL if needed
    timeout: 30000,
  }
};

// Get current environment
const isDevelopment = import.meta.env.DEV;
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
