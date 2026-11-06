import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ResultScreen } from '@/features/scanner/ResultScreen';
import { apiDownloadBytes, apiRequest } from '@/lib/api';

const mockReplace = jest.fn();
const mockClearWorkflow = jest.fn();
const mockDeleteCachedImage = jest.fn();
const mockWriteCachedImage = jest.fn();

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useLocalSearchParams: () => ({ jobId: '7' }),
}));

jest.mock('expo-file-system', () => ({
  Paths: { cache: 'file:///cache' },
  File: class MockFile {
    exists = true;
    size = 4;
    uri = 'file:///cache/annotated-answer-sheet.jpg';

    write = mockWriteCachedImage;
    delete = mockDeleteCachedImage;

    constructor() {}
  },
}));

jest.mock('@/features/scanner/ScannerWorkflowContext', () => ({
  useScannerWorkflow: () => ({ clearWorkflow: mockClearWorkflow }),
}));

jest.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({ token: 'staff-token' }),
}));

jest.mock('@/lib/api', () => ({
  ApiError: class ApiError extends Error {},
  apiDownloadBytes: jest.fn(),
  apiRequest: jest.fn(),
}));

jest.setTimeout(30_000);

const result = {
  id: 44,
  score: '98.02',
  status: 'Passed' as const,
  total_items: 100,
  correct_count: 98,
  incorrect_count: 2,
  passing_score: '75.00',
  answer_key: {
    id: 9,
    exam_title: 'TMC Entrance Examination',
  },
};

const applicant = {
  id: 13,
  applicant_name: 'Dela Cruz, Maria A.',
  examination_date: '2026-11-04T00:00:00.000000Z',
  course: 'BSIT',
  folder_id: null,
  filed_at: null,
  folder: null,
};

const folders = [
  { id: 3, school_year: 'SY 2026-2027', course: '', status: 'Active' as const },
];

describe('<ResultScreen />', () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockClearWorkflow.mockReset();
    mockDeleteCachedImage.mockReset();
    mockWriteCachedImage.mockReset();
    mockWriteCachedImage.mockResolvedValue(undefined);
    jest.mocked(apiDownloadBytes).mockReset();
    jest.mocked(apiDownloadBytes).mockResolvedValue(new Uint8Array([255, 216, 255, 217]));
    jest.mocked(apiRequest).mockImplementation(async (path) => {
      if (path === '/omr-jobs/7') {
        return {
          job: { id: 7, status: 'Completed' },
          result,
          applicant,
        };
      }

      if (path === '/folders?status=Active') {
        return folders;
      }

      if (path === '/results/44/file') {
        return {
          message: 'Successfully Saved To Admin Portal',
          applicant: {
            ...applicant,
            folder_id: 3,
            filed_at: '2026-11-04T10:00:00.000000Z',
            folder: folders[0],
          },
          result,
        };
      }

      throw new Error(`Unexpected API path: ${path}`);
    });
  });

  test('renders the prototype score summary and applicant details', async () => {
    await render(<ResultScreen />);

    expect(
      await screen.findByText('Examination Result', {}, { timeout: 5_000 }),
    ).toBeTruthy();
    expect(screen.getByText('Dela Cruz, Maria A.')).toBeTruthy();
    expect(screen.getByText('EXM-0013')).toBeTruthy();
    expect(screen.getByText('Examination Date: Nov 4, 2026')).toBeTruthy();
    expect(screen.getByText('98%')).toBeTruthy();
    expect(screen.getAllByText('Passed')).toHaveLength(2);
    expect(screen.getByText('Correct Answers')).toBeTruthy();
    expect(screen.getByText('Answer Key')).toBeTruthy();
    expect(screen.getByText('TMC Entrance Examination')).toBeTruthy();
    expect(screen.getByText('98')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('Total Items')).toBeTruthy();
    expect(screen.getByText('100')).toBeTruthy();
    expect(apiRequest).toHaveBeenCalledWith('/omr-jobs/7', {
      method: 'GET',
      token: 'staff-token',
    });
    expect(apiRequest).toHaveBeenCalledWith('/folders?status=Active', {
      method: 'GET',
      token: 'staff-token',
    });
  });

  test('opens the annotated scanned-sheet viewer and displays its legend', async () => {
    await render(<ResultScreen />);

    await screen.findByText('Examination Result');
    await fireEvent.press(screen.getByRole('button', { name: 'View Scanned Sheet' }));

    expect(screen.getByText('Scanned Sheet')).toBeTruthy();
    expect(screen.getByText('Annotated OMR review')).toBeTruthy();
    expect(screen.getByText('LEGEND')).toBeTruthy();
    expect(screen.getByText('Correct answer')).toBeTruthy();
    expect(screen.getByText('Wrong answer')).toBeTruthy();
    expect(screen.getByText('Blank')).toBeTruthy();
    expect(screen.getByText('Multi-shade')).toBeTruthy();
    expect(screen.getByText('Erasure')).toBeTruthy();

    await waitFor(() => {
      expect(apiDownloadBytes).toHaveBeenCalledWith(
        '/omr-jobs/7/annotated-image',
        'staff-token',
      );
      expect(mockWriteCachedImage).toHaveBeenCalled();
    });

    await fireEvent.press(screen.getByRole('button', { name: 'Close scanned sheet viewer' }));
    expect(screen.queryByText('Annotated OMR review')).toBeNull();
    expect(mockDeleteCachedImage).toHaveBeenCalled();
  });

  test('files the result into the selected active folder and confirms the save', async () => {
    await render(<ResultScreen />);

    await screen.findByText('Examination Result');
    await fireEvent.press(screen.getByRole('button', { name: 'Choose school year folder' }));
    expect(screen.getByText('School Year Folder')).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Select SY 2026-2027' }));
    expect(screen.getByText('SY 2026-2027 — Current')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Save to Admin Portal' }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith('/results/44/file', {
        method: 'POST',
        body: JSON.stringify({ folder_id: 3 }),
        token: 'staff-token',
      });
      expect(screen.getByText('Successfully Saved To Admin Portal')).toBeTruthy();
      expect(screen.getByText('SY 2026-2027')).toBeTruthy();
    });

    await fireEvent.press(screen.getByRole('button', { name: 'Scan Another Sheet' }));
    expect(mockClearWorkflow).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  test('shows an already filed result as saved without allowing another folder', async () => {
    jest.mocked(apiRequest).mockImplementation(async (path) => {
      if (path === '/omr-jobs/7') {
        return {
          job: { id: 7, status: 'Completed' },
          result,
          applicant: {
            ...applicant,
            folder_id: 3,
            filed_at: '2026-11-04T10:00:00.000000Z',
            folder: folders[0],
          },
        };
      }

      if (path === '/folders?status=Active') {
        return folders;
      }

      throw new Error(`Unexpected API path: ${path}`);
    });

    await render(<ResultScreen />);

    expect(await screen.findByText('Successfully Saved To Admin Portal')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Choose school year folder' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Scan Another Sheet' })).toBeTruthy();
  });
});
