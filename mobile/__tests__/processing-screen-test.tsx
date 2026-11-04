import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ProcessingScreen } from '@/features/scanner/ProcessingScreen';
import { apiRequest, apiUploadFile } from '@/lib/api';

const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockSetApplicant = jest.fn();
let mockApplicant: { id: number; code: string } | null = { id: 42, code: 'EXM-0042' };
let mockApplicantDraft: {
  applicantName: string;
  examinationDate: string;
  mobileNumber: string;
  studentType: 'NEW';
  course: string;
} | null = null;

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

jest.mock('expo-file-system', () => ({
  File: class MockFile {
    exists = true;
    size = 11;
    name = 'answer-sheet.jpg';
    type = 'image/jpeg';

    constructor() {}
  },
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace }),
}));

jest.mock('@/features/scanner/ScannerWorkflowContext', () => {
  const { useState } = jest.requireActual<typeof import('react')>('react');

  return {
    useScannerWorkflow: () => {
      const [applicant, setWorkflowApplicant] = useState(mockApplicant);

      return {
        applicant,
        applicantDraft: mockApplicantDraft,
        photo: { uri: 'file:///answer-sheet.jpg', mimeType: 'image/jpeg' },
        setApplicant: (next: { id: number; code: string } | null) => {
          mockSetApplicant(next);
          setWorkflowApplicant(next);
        },
        source: 'capture',
        submissionId: 'd8bf7409-4b34-4459-a0c8-a37c6260a953',
      };
    },
  };
});

jest.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({ token: 'staff-token' }),
}));

jest.mock('@/lib/api', () => ({
  ApiError: class ApiError extends Error {},
  apiRequest: jest.fn(),
  apiUploadFile: jest.fn(),
}));

describe('<ProcessingScreen />', () => {
  beforeEach(() => {
    mockApplicant = { id: 42, code: 'EXM-0042' };
    mockApplicantDraft = null;
    mockReplace.mockReset();
    mockSetApplicant.mockReset();
    jest.mocked(apiUploadFile).mockResolvedValue({ applicant: { id: 42 }, job: { id: 7 } });
    jest.mocked(apiRequest).mockImplementation(async (path) => {
      return { job: { id: 7, status: 'Completed' } };
    });
  });

  test('renders the prototype processing screen and monitors the uploaded job', async () => {
    await render(<ProcessingScreen />);

    expect(screen.getByText('Processing')).toBeTruthy();
    expect(screen.getByText('EXM-0042')).toBeTruthy();
    expect(screen.getByText('Analyzing the answer sheet...')).toBeTruthy();

    await waitFor(() => {
      expect(apiUploadFile).toHaveBeenCalledWith(
        '/sheets/upload',
        expect.anything(),
        expect.objectContaining({
          fieldName: 'image',
          mimeType: 'image/jpeg',
          parameters: { applicant_id: '42' },
          token: 'staff-token',
        }),
      );
      expect(screen.getByText('Answer sheet processed.')).toBeTruthy();
    });
  });

  test('creates the applicant together with the first successful upload', async () => {
    mockApplicant = null;
    mockApplicantDraft = {
      applicantName: 'Juan Dela Cruz',
      examinationDate: '2026-11-04',
      mobileNumber: '09123456789',
      studentType: 'NEW',
      course: 'BSIT',
    };
    jest.mocked(apiUploadFile).mockResolvedValue({ applicant: { id: 51 }, job: { id: 8 } });

    await render(<ProcessingScreen />);

    await waitFor(() => {
      expect(apiUploadFile).toHaveBeenCalledWith(
        '/sheets/upload',
        expect.anything(),
        expect.objectContaining({
          parameters: {
            submission_uuid: 'd8bf7409-4b34-4459-a0c8-a37c6260a953',
            applicant_name: 'Juan Dela Cruz',
            examination_date: '2026-11-04',
            mobile_number: '09123456789',
            student_type: 'NEW',
            course: 'BSIT',
          },
        }),
      );
      expect(mockSetApplicant).toHaveBeenCalledWith({ id: 51, code: 'EXM-0051' });
    });

    // The workflow context now reports the new applicant id. Monitoring must
    // keep polling instead of being cancelled by that re-render.
    expect(await screen.findByRole('button', { name: 'View Result' })).toBeTruthy();
    expect(screen.getByText('Answer sheet processed.')).toBeTruthy();
  });

  test('opens the result screen when processing finishes', async () => {
    await render(<ProcessingScreen />);

    const viewResult = await screen.findByRole('button', { name: 'View Result' });
    await fireEvent.press(viewResult);

    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/result',
      params: { jobId: '7' },
    });
  });
});
