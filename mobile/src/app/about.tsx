import { Redirect } from 'expo-router';

import { useAuth } from '@/auth/AuthContext';
import { AppLoadingScreen } from '@/components/AppLoadingScreen';
import { AboutScreen } from '@/features/about/AboutScreen';

export default function AboutRoute() {
  const { user, isRestoring } = useAuth();

  if (isRestoring) {
    return <AppLoadingScreen />;
  }

  if (!user) {
    return <Redirect href="/" />;
  }

  return <AboutScreen />;
}
