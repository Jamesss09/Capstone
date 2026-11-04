import { fireEvent, render, screen } from '@testing-library/react-native';

import { IdentifyApplicantScreen } from '@/features/scanner/IdentifyApplicantScreen';

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockSignOut = jest.fn();
const mockSetApplicantDraft = jest.fn();

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
}));

jest.mock('@/features/scanner/ScannerWorkflowContext', () => ({
  useScannerWorkflow: () => ({
    applicantDraft: null,
    photo: { uri: 'file:///answer-sheet.jpg', mimeType: 'image/jpeg' },
    setApplicantDraft: mockSetApplicantDraft,
  }),
}));

jest.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({ token: 'staff-token', signOut: mockSignOut }),
}));

describe('<IdentifyApplicantScreen />', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockSetApplicantDraft.mockReset();
  });

  test('renders the prototype identification fields', async () => {
    await render(<IdentifyApplicantScreen />);

    expect(screen.getByText('Identify Applicant')).toBeTruthy();
    expect(screen.getByLabelText('Full Name')).toBeTruthy();
    expect(screen.getByLabelText('Exam Date')).toBeTruthy();
    expect(screen.getByLabelText('Mobile Number (Optional)')).toBeTruthy();
    expect(screen.getByText('APPLICANT TYPE')).toBeTruthy();
    expect(screen.getByText(/COURSE TO ENROLL/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue to processing' })).toBeTruthy();
    expect(screen.queryByLabelText('Applicant ID')).toBeNull();
  });

  test('requires the applicant details before submission', async () => {
    await render(<IdentifyApplicantScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Continue to processing' }));

    expect(screen.getByText(/Enter the applicant/)).toBeTruthy();
  });

  test('keeps applicant details as a draft until the image upload succeeds', async () => {
    await render(<IdentifyApplicantScreen />);

    await fireEvent.changeText(screen.getByLabelText('Full Name'), 'Juan Dela Cruz');
    await fireEvent.changeText(screen.getByLabelText('Exam Date'), '11042026');
    await fireEvent.changeText(
      screen.getByLabelText('Mobile Number (Optional)'),
      '09123456789',
    );
    await fireEvent.press(screen.getByRole('radio', { name: 'BSIT' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Continue to processing' }));

    expect(mockSetApplicantDraft).toHaveBeenCalledWith({
      applicantName: 'Juan Dela Cruz',
      examinationDate: '2026-11-04',
      mobileNumber: '09123456789',
      studentType: 'NEW',
      course: 'BSIT',
    });
    expect(mockPush).toHaveBeenCalledWith('/processing');
  });
});
