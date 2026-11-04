import { Redirect } from 'expo-router';

import { useAuth } from '@/auth/AuthContext';
import { AppLoadingScreen } from '@/components/AppLoadingScreen';
import { IdentifyApplicantScreen } from '@/features/scanner/IdentifyApplicantScreen';

export default function IdentifyApplicantRoute() {
  const { user, isRestoring } = useAuth();

  if (isRestoring) {
    return <AppLoadingScreen />;
  }

  if (!user) {
    return <Redirect href="/" />;
  }

  return <IdentifyApplicantScreen />;
}
