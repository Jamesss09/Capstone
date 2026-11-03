import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputInstance,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthContext';
import { colors } from '@/theme/colors';

export function LoginScreen() {
  const { signIn } = useAuth();
  const passwordRef = useRef<TextInputInstance>(null);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function clearError() {
    if (error) {
      setError('');
    }
  }

  async function submit() {
    const normalizedLogin = login.trim();
    if (!normalizedLogin || !password) {
      setError('Enter your username and password.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await signIn(normalizedLogin, password, remember);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Sign in failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'right', 'bottom', 'left']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.page}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Image
              source={require('../../../assets/tmc-seal.png')}
              accessibilityLabel="Trinidad Municipal College seal"
              resizeMode="contain"
              style={styles.logo}
            />

            <View style={styles.headingBlock}>
              <Text style={styles.title}>TMC Entrance Exam</Text>
              <Text style={styles.systemName}>Scoring System</Text>
              <Text style={styles.subtitle}>Sign in to access the mobile examination scanner.</Text>
            </View>

            {error ? (
              <View accessibilityLiveRegion="polite" style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" color={colors.danger} size={18} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>USERNAME</Text>
              <View style={styles.inputShell}>
                <Ionicons name="person-outline" color={colors.muted} size={22} />
                <TextInput
                  value={login}
                  onChangeText={(value) => {
                    setLogin(value);
                    clearError();
                  }}
                  editable={!loading}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="username"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  placeholder="Enter your username"
                  placeholderTextColor={colors.placeholder}
                  style={styles.input}
                  accessibilityLabel="Username or email"
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>PASSWORD</Text>
              <View style={styles.inputShell}>
                <Ionicons name="lock-closed-outline" color={colors.muted} size={22} />
                <TextInput
                  ref={passwordRef}
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    clearError();
                  }}
                  editable={!loading}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="password"
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={() => void submit()}
                  placeholder="Enter your password"
                  placeholderTextColor={colors.placeholder}
                  style={styles.input}
                  accessibilityLabel="Password"
                />
                <Pressable
                  onPress={() => setShowPassword((visible) => !visible)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    color={colors.muted}
                    size={22}
                  />
                </Pressable>
              </View>
            </View>

            <Pressable
              onPress={() => setRemember((selected) => !selected)}
              disabled={loading}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: remember }}
              style={styles.rememberRow}
            >
              <View style={[styles.checkbox, remember && styles.checkboxSelected]}>
                {remember ? <Ionicons name="checkmark" color={colors.surface} size={15} /> : null}
              </View>
              <Text style={styles.rememberText}>Remember Me</Text>
            </Pressable>

            <Pressable
              onPress={() => void submit()}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Sign In"
              style={({ pressed }) => [
                styles.signInButton,
                pressed && styles.signInButtonPressed,
                loading && styles.signInButtonDisabled,
              ]}
            >
              {loading ? (
                <ActivityIndicator color={colors.gold} />
              ) : (
                <View style={styles.signInContent}>
                  <Text style={styles.signInText}>Sign In</Text>
                  <Ionicons name="arrow-forward" color={colors.gold} size={20} />
                </View>
              )}
            </Pressable>

            <View style={styles.cardFooter}>
              <Text style={styles.cardFooterText}>TMC Entrance Exam Scoring System</Text>
              <View style={styles.footerDot} />
              <Text style={styles.cardFooterText}>Code Nexus</Text>
            </View>
          </View>

          <View style={styles.institutionBlock}>
            <View style={styles.goldLine} />
            <Text style={styles.institutionName}>Trinidad Municipal College</Text>
            <Text style={styles.institutionSubtitle}>Entrance Examination Management System</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  page: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 24,
  },
  card: {
    width: '100%',
    maxWidth: 470,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 26,
    shadowColor: colors.navy,
    shadowOpacity: 0.1,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  logo: {
    width: 96,
    height: 96,
    alignSelf: 'center',
  },
  headingBlock: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 28,
  },
  title: {
    color: colors.navy,
    fontSize: 25,
    lineHeight: 31,
    fontWeight: '800',
    textAlign: 'center',
  },
  systemName: {
    color: colors.muted,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '500',
    textAlign: 'center',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 12,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerBackground,
    marginBottom: 18,
  },
  errorText: {
    flex: 1,
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18,
  },
  fieldGroup: {
    marginBottom: 18,
  },
  label: {
    color: colors.navy,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  inputShell: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.input,
    paddingHorizontal: 15,
  },
  input: {
    flex: 1,
    minHeight: 52,
    color: colors.text,
    fontSize: 15,
    paddingVertical: 0,
  },
  rememberRow: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 40,
    marginTop: -4,
  },
  checkbox: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.muted,
    backgroundColor: colors.surface,
  },
  checkboxSelected: {
    borderColor: colors.navy,
    backgroundColor: colors.navy,
  },
  rememberText: {
    color: colors.muted,
    fontSize: 14,
  },
  signInButton: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.navy,
    marginTop: 28,
  },
  signInButtonPressed: {
    backgroundColor: colors.navyPressed,
  },
  signInButtonDisabled: {
    opacity: 0.7,
  },
  signInContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  signInText: {
    color: colors.gold,
    fontSize: 16,
    fontWeight: '800',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 30,
  },
  cardFooterText: {
    color: colors.muted,
    fontSize: 11,
    textAlign: 'center',
  },
  footerDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.gold,
  },
  institutionBlock: {
    alignItems: 'center',
    marginTop: 26,
  },
  goldLine: {
    width: 48,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.gold,
    marginBottom: 15,
  },
  institutionName: {
    color: colors.navy,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  institutionSubtitle: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 8,
  },
});
