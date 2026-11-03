import { render, screen } from '@testing-library/react-native';

import { ScannerHomeScreen } from '@/features/scanner/ScannerHomeScreen';

const mockSignOut = jest.fn();

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

jest.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { full_name: 'Sample Staff' },
    signOut: mockSignOut,
  }),
}));

describe('<ScannerHomeScreen />', () => {
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
});
