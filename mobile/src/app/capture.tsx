import { Redirect } from 'expo-router';

import { useAuth } from '@/auth/AuthContext';
import { AppLoadingScreen } from '@/components/AppLoadingScreen';
import { CaptureScreen } from '@/features/scanner/CaptureScreen';

export default function CaptureRoute() {
  const { user, isRestoring } = useAuth();

  if (isRestoring) {
    return <AppLoadingScreen />;
  }

  if (!user) {
    return <Redirect href="/" />;
  }

  return <CaptureScreen />;
}
