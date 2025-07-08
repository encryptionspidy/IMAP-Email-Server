// Jest test setup file
// This file runs before each test file

// Set test environment variables
process.env['NODE_ENV'] = 'test';
process.env['GEMINI_API_KEY'] = 'test-api-key';

// Increase timeout for integration tests
jest.setTimeout(30000);

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
  log: jest.fn(),
}; 