import { fireEvent, render, screen } from '@testing-library/react-native';

import { ScannerHomeScreen } from '@/features/scanner/ScannerHomeScreen';

const mockSignOut = jest.fn();
const mockPush = jest.fn();
const mockClearWorkflow = jest.fn();

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/features/scanner/ScannerWorkflowContext', () => ({
  useScannerWorkflow: () => ({ clearWorkflow: mockClearWorkflow }),
}));

jest.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { full_name: 'Sample Staff' },
    signOut: mockSignOut,
  }),
}));

describe('<ScannerHomeScreen />', () => {
  beforeEach(() => {
    mockSignOut.mockReset();
    mockPush.mockReset();
    mockClearWorkflow.mockReset();
  });

  test('renders the prototype scanner home controls', async () => {
    await render(<ScannerHomeScreen />);

    expect(screen.getByText('EXAMINATION STAFF')).toBeTruthy();
    expect(screen.getByText('TMC Scanner')).toBeTruthy();
    expect(screen.getByText('Scan Answer Sheet')).toBeTruthy();
    expect(screen.getByText('Position the OMR sheet inside the frame.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start Scan' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Upload Photo' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign Out' })).toBeTruthy();
  });

  test('asks for confirmation before signing out', async () => {
    await render(<ScannerHomeScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Sign Out' }));

    expect(screen.getByText('Sign out?')).toBeTruthy();
    expect(screen.getByText('Are you sure you want to sign out of your staff account?')).toBeTruthy();
    expect(mockSignOut).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Confirm Sign Out' }));

    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  test('opens the Capture screen from Start Scan', async () => {
    await render(<ScannerHomeScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Start Scan' }));

    expect(mockPush).toHaveBeenCalledWith('/capture');
    expect(mockClearWorkflow).toHaveBeenCalledTimes(1);
  });

  test('opens the photo upload screen from Upload Photo', async () => {
    await render(<ScannerHomeScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Upload Photo' }));

    expect(mockPush).toHaveBeenCalledWith('/upload');
    expect(mockClearWorkflow).toHaveBeenCalledTimes(1);
  });
});
