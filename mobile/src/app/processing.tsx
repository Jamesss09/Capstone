import { Redirect } from 'expo-router';

import { useAuth } from '@/auth/AuthContext';
import { AppLoadingScreen } from '@/components/AppLoadingScreen';
import { ProcessingScreen } from '@/features/scanner/ProcessingScreen';

export default function ProcessingRoute() {
  const { user, isRestoring } = useAuth();

  if (isRestoring) {
    return <AppLoadingScreen />;
  }

  if (!user) {
    return <Redirect href="/" />;
  }

  return <ProcessingScreen />;
}
