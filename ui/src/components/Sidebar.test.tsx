import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import Sidebar from './Sidebar';
import { useEmailStore } from '../stores/emailStore';
import { act } from 'react-dom/test-utils';

jest.mock('../stores/emailStore');

const mockSetComposeOpen = jest.fn();
const mockSetCurrentFolder = jest.fn();
const mockResetEmailConfig = jest.fn();
const mockSetIsSettingsOpen = jest.fn();

(useEmailStore as jest.Mock).mockReturnValue({
  folders: [],
  labels: [],
  currentFolder: 'INBOX',
  setCurrentFolder: mockSetCurrentFolder,
  account: null,
  getUnreadCount: () => 15,
  setComposeOpen: mockSetComposeOpen,
  resetEmailConfig: mockResetEmailConfig,
});

describe('Sidebar', () => {
  it('renders correctly (snapshot)', () => {
    const { asFragment } = render(<Sidebar />);
    expect(asFragment()).toMatchSnapshot();
  });

  it('opens compose modal when Compose button is clicked', () => {
    const { getByText } = render(<Sidebar />);
    fireEvent.click(getByText('Compose'));
    expect(mockSetComposeOpen).toHaveBeenCalledWith(true);
  });

  it('toggles theme and persists to localStorage', () => {
    const { getByText } = render(<Sidebar />);
    const themeButton = getByText(/Mode/);
    act(() => {
      fireEvent.click(themeButton);
    });
    expect(['dark', 'light']).toContain(localStorage.getItem('theme'));
  });

  it('calls resetEmailConfig and redirects on logout', () => {
    delete window.location;
    // @ts-ignore
    window.location = { href: '' };
    const { getByText } = render(<Sidebar />);
    fireEvent.click(getByText('Logout'));
    expect(mockResetEmailConfig).toHaveBeenCalled();
    expect(window.location.href).toBe('/');
  });
}); 