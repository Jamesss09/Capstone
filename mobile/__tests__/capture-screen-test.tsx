import { fireEvent, render, screen } from '@testing-library/react-native';

import { CaptureScreen } from '@/features/scanner/CaptureScreen';

const mockBack = jest.fn();
const mockSignOut = jest.fn();

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

jest.mock('expo-router', () => ({
  useIsFocused: () => true,
  useRouter: () => ({ back: mockBack }),
}));

jest.mock('@/features/scanner/ScannerWorkflowContext', () => ({
  useScannerWorkflow: () => ({
    applicant: null,
    setPhoto: jest.fn(),
    setSource: jest.fn(),
  }),
}));

jest.mock('expo-camera', () => ({
  CameraView: () => null,
  useCameraPermissions: () => [
    { granted: true, canAskAgain: true },
    jest.fn(),
    jest.fn(),
  ],
}));

jest.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({ signOut: mockSignOut }),
}));

describe('<CaptureScreen />', () => {
  test('renders the capture workflow and Back action', async () => {
    await render(<CaptureScreen />);

    expect(screen.getByText('CAPTURE')).toBeTruthy();
    expect(screen.getByText('Step 1 of 4')).toBeTruthy();
    expect(screen.getByText('Scan Answer Sheet')).toBeTruthy();
    expect(
      screen.getByText(
        'Use bright, even lighting. Keep the entire sheet flat and inside the frame.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Align OMR sheet within the frame')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Capture answer sheet' })).toBeDisabled();
    const backButton = screen.getByRole('button', { name: 'Back to Scanner Home' });
    expect(backButton).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Sign Out' })).toBeNull();

    fireEvent.press(backButton);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
