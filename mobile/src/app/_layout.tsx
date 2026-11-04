import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider } from '@/auth/AuthContext';
import { ScannerWorkflowProvider } from '@/features/scanner/ScannerWorkflowContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <ScannerWorkflowProvider>
        <Stack screenOptions={{ headerShown: false }} />
        <StatusBar style="dark" />
      </ScannerWorkflowProvider>
    </AuthProvider>
  );
}
