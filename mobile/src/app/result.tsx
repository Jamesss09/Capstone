import { Redirect } from 'expo-router';

import { useAuth } from '@/auth/AuthContext';
import { AppLoadingScreen } from '@/components/AppLoadingScreen';
import { ResultScreen } from '@/features/scanner/ResultScreen';

export default function ResultRoute() {
  const { user, isRestoring } = useAuth();

  if (isRestoring) {
    return <AppLoadingScreen />;
  }

  if (!user) {
    return <Redirect href="/" />;
  }

  return <ResultScreen />;
}
