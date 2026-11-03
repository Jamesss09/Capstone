import { AppLoadingScreen } from '@/components/AppLoadingScreen';
import { useAuth } from '@/auth/AuthContext';
import { LoginScreen } from '@/features/auth/LoginScreen';
import { ScannerHomeScreen } from '@/features/scanner/ScannerHomeScreen';

export default function IndexRoute() {
  const { user, isRestoring } = useAuth();

  if (isRestoring) {
    return <AppLoadingScreen />;
  }

  return user ? <ScannerHomeScreen /> : <LoginScreen />;
}
