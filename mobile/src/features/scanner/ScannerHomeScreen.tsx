import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScannerHeader } from '@/features/scanner/ScannerHeader';
import { useScannerWorkflow } from '@/features/scanner/ScannerWorkflowContext';
import { colors } from '@/theme/colors';

export function ScannerHomeScreen() {
  const router = useRouter();
  const { clearWorkflow } = useScannerWorkflow();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'right', 'bottom', 'left']}>
      <ScannerHeader />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Image
          source={require('../../../assets/tmc-seal.png')}
          accessibilityLabel="Trinidad Municipal College seal"
          resizeMode="contain"
          style={styles.logo}
        />

        <Text style={styles.title}>Scan Answer Sheet</Text>
        <Text style={styles.subtitle}>Position the OMR sheet inside the frame.</Text>

        <View style={styles.actions}>
          <Pressable
            onPress={() => {
              clearWorkflow();
              router.push('/capture');
            }}
            accessibilityRole="button"
            accessibilityLabel="Start Scan"
            style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
          >
            <Ionicons name="scan-outline" color={colors.navy} size={21} />
            <Text style={styles.primaryButtonText}>Start Scan</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              clearWorkflow();
              router.push('/upload');
            }}
            accessibilityRole="button"
            accessibilityLabel="Upload Photo"
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.secondaryButtonPressed,
            ]}
          >
            <Ionicons name="image-outline" color={colors.navy} size={20} />
            <Text style={styles.secondaryButtonText}>Upload Photo</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  logo: {
    width: 74,
    height: 74,
  },
  title: {
    color: colors.navy,
    fontSize: 23,
    lineHeight: 30,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 14,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 2,
  },
  actions: {
    width: '100%',
    maxWidth: 470,
    gap: 10,
    marginTop: 17,
  },
  primaryButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 10,
    backgroundColor: colors.gold,
    paddingHorizontal: 18,
  },
  primaryButtonPressed: {
    opacity: 0.84,
  },
  primaryButtonText: {
    color: colors.navy,
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    paddingHorizontal: 18,
  },
  secondaryButtonPressed: {
    backgroundColor: colors.input,
  },
  secondaryButtonText: {
    color: colors.navy,
    fontSize: 14,
    fontWeight: '800',
  },
});
