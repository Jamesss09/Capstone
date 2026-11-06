import { fireEvent, render, screen } from '@testing-library/react-native';

import { AboutScreen } from '@/features/about/AboutScreen';

const mockBack = jest.fn();

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
}));

jest.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({ signOut: jest.fn() }),
}));

describe('<AboutScreen />', () => {
  beforeEach(() => {
    mockBack.mockReset();
  });

  test('shows app guidance and all capstone team members', async () => {
    await render(<AboutScreen />);

    expect(screen.getByText('App Information')).toBeTruthy();
    expect(screen.getByText('How to Use the App')).toBeTruthy();
    expect(screen.getByText('Scanning Tips')).toBeTruthy();
    expect(screen.getByText('Capstone Team')).toBeTruthy();
    expect(screen.getByText('Faye Marie Busalanan')).toBeTruthy();
    expect(screen.getByText('Honeylet Montoya')).toBeTruthy();
    expect(screen.getByText('James Carl Enquig')).toBeTruthy();
    expect(screen.getByText('John Paul Amistad')).toBeTruthy();
    expect(screen.getByText('Pedro Aclo')).toBeTruthy();
  });

  test('returns to scanner home', async () => {
    await render(<AboutScreen />);

    fireEvent.press(screen.getByRole('button', { name: 'Back to Scanner Home' }));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
