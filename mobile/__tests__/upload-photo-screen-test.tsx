import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';

import { UploadPhotoScreen } from '@/features/scanner/UploadPhotoScreen';

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockSignOut = jest.fn();
const mockSetPhoto = jest.fn();
const mockSetSource = jest.fn();
const mockPersistAnswerSheetPhoto = jest.fn(async (uri: string, _mimeType: string) => uri);
let mockApplicant: { id: number; code: string } | null = null;

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush, replace: mockReplace }),
}));

jest.mock('@/features/scanner/ScannerWorkflowContext', () => ({
  useScannerWorkflow: () => ({
    applicant: mockApplicant,
    setPhoto: mockSetPhoto,
    setSource: mockSetSource,
  }),
}));

jest.mock('@/features/scanner/answerSheetPhoto', () => ({
  persistAnswerSheetPhoto: (uri: string, mimeType: string) =>
    mockPersistAnswerSheetPhoto(uri, mimeType),
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({ token: 'staff-token', signOut: mockSignOut }),
}));

describe('<UploadPhotoScreen />', () => {
  beforeEach(() => {
    mockBack.mockReset();
    mockPush.mockReset();
    mockReplace.mockReset();
    mockSetPhoto.mockReset();
    mockSetSource.mockReset();
    mockPersistAnswerSheetPhoto.mockClear();
    mockApplicant = null;
    jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockReset();
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockReset();
  });

  test('renders photo selection without an Applicant ID field', async () => {
    await render(<UploadPhotoScreen />);

    expect(screen.getByText('Upload Answer Sheet')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Choose answer sheet photo' })).toBeTruthy();
    expect(screen.queryByLabelText('Applicant ID')).toBeNull();
  });

  test('continues to applicant identification after selecting a photo', async () => {
    jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue({
      granted: true,
      canAskAgain: true,
      expires: 'never',
    } as never);
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [{
        uri: 'file:///answer-sheet.png',
        fileName: 'answer-sheet.png',
        mimeType: 'image/png',
        width: 100,
        height: 100,
        type: 'image',
      }],
    } as never);
    await render(<UploadPhotoScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Choose answer sheet photo' }));

    await waitFor(() => {
      expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
        selectionLimit: 1,
      });
      expect(mockPersistAnswerSheetPhoto).toHaveBeenCalledWith(
        'file:///answer-sheet.png',
        'image/png',
      );
      expect(mockSetSource).toHaveBeenCalledWith('upload');
      expect(mockSetPhoto).toHaveBeenCalledWith({
        uri: 'file:///answer-sheet.png',
        fileName: 'answer-sheet.png',
        mimeType: 'image/png',
      });
      expect(mockPush).toHaveBeenCalledWith('/identify-applicant');
    });
  });

  test('reuses the existing applicant when selecting a replacement photo', async () => {
    mockApplicant = { id: 42, code: 'EXM-0042' };
    jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue({
      granted: true,
      canAskAgain: true,
      expires: 'never',
    } as never);
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [{
        uri: 'file:///replacement.jpg',
        fileName: 'replacement.jpg',
        mimeType: 'image/jpeg',
        width: 100,
        height: 100,
        type: 'image',
      }],
    } as never);
    await render(<UploadPhotoScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Choose answer sheet photo' }));

    await waitFor(() => {
      expect(mockSetPhoto).toHaveBeenCalledWith({
        uri: 'file:///replacement.jpg',
        fileName: 'replacement.jpg',
        mimeType: 'image/jpeg',
      });
      expect(mockReplace).toHaveBeenCalledWith('/processing');
      expect(mockPush).not.toHaveBeenCalled();
    });
  });
});
