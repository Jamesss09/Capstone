import { Ionicons } from '@expo/vector-icons';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthContext';
import { colors } from '@/theme/colors';

export function ScannerHomeScreen() {
  const { signOut } = useAuth();

  function showNextScreenCheckpoint(action: 'scan' | 'upload') {
    Alert.alert(
      action === 'scan' ? 'Start Scan' : 'Upload Photo',
      'The Scan Answer Sheet screen will be connected after Scanner Home is reviewed.',
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'right', 'bottom', 'left']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>EXAMINATION STAFF</Text>
          <Text style={styles.appName}>TMC Scanner</Text>
        </View>

        <Pressable
          onPress={() => void signOut()}
          accessibilityRole="button"
          accessibilityLabel="Sign Out"
          hitSlop={10}
          style={({ pressed }) => [styles.signOutButton, pressed && styles.signOutButtonPressed]}
        >
          <Ionicons name="log-out-outline" color={colors.navy} size={18} />
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </Pressable>
      </View>

      <View style={styles.divider} />

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
            onPress={() => showNextScreenCheckpoint('scan')}
            accessibilityRole="button"
            accessibilityLabel="Start Scan"
            style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
          >
            <Ionicons name="scan-outline" color={colors.navy} size={21} />
            <Text style={styles.primaryButtonText}>Start Scan</Text>
          </Pressable>

          <Pressable
            onPress={() => showNextScreenCheckpoint('upload')}
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
  header: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  eyebrow: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '700',
    letterSpacing: 1.25,
  },
  appName: {
    color: colors.navy,
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '800',
  },
  signOutButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  signOutButtonPressed: {
    backgroundColor: colors.input,
  },
  signOutButtonText: {
    color: colors.navy,
    fontSize: 13,
    fontWeight: '700',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
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
