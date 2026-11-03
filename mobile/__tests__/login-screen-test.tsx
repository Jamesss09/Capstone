import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { LoginScreen } from '@/features/auth/LoginScreen';

const mockSignIn = jest.fn();

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

jest.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({ signIn: mockSignIn }),
}));

describe('<LoginScreen />', () => {
  beforeEach(() => {
    mockSignIn.mockReset();
  });

  test('renders the prototype login controls', async () => {
    await render(<LoginScreen />);

    expect(screen.getByText('TMC Entrance Exam')).toBeTruthy();
    expect(screen.getByLabelText('Username or email')).toBeTruthy();
    expect(screen.getByLabelText('Password')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Remember Me' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeTruthy();
  });

  test('requires both credentials before calling Laravel', async () => {
    await render(<LoginScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByText('Enter your username and password.')).toBeTruthy();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  test('submits normalized credentials and remember preference', async () => {
    mockSignIn.mockResolvedValue(undefined);
    await render(<LoginScreen />);

    await fireEvent.changeText(screen.getByLabelText('Username or email'), '  staff-user  ');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'secret');
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Remember Me' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('staff-user', 'secret', true);
    });
  });

  test('shows an authentication error returned by the session layer', async () => {
    mockSignIn.mockRejectedValue(new Error('Invalid credentials.'));
    await render(<LoginScreen />);

    await fireEvent.changeText(screen.getByLabelText('Username or email'), 'staff-user');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'wrong');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByText('Invalid credentials.')).toBeTruthy();
  });
});
