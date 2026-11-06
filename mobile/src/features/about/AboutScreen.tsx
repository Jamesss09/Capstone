import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScannerHeader } from '@/features/scanner/ScannerHeader';
import { colors } from '@/theme/colors';

const WORKFLOW = [
  {
    title: 'Capture or upload',
    description: 'Photograph the complete OMR answer sheet or select a clear image from the device.',
  },
  {
    title: 'Identify the applicant',
    description: 'Enter the applicant details and select the intended course before processing.',
  },
  {
    title: 'Process the sheet',
    description: 'The app securely uploads the sheet while the OMR service detects and scores the bubbles.',
  },
  {
    title: 'Review the result',
    description: 'Check the score, status, and item summary produced by the examination system.',
  },
  {
    title: 'Save to the portal',
    description: 'Choose the active school-year folder and save the completed result to the Admin Portal.',
  },
] as const;

const TEAM = [
  { name: 'Faye Marie Busalanan', role: 'Project Manager' },
  { name: 'Honeylet Montoya', role: 'Documentation Lead' },
  { name: 'James Carl Enquig', role: 'Lead Developer' },
  { name: 'John Paul Amistad', role: 'Tester' },
  { name: 'Pedro Aclo', role: 'System Analyst' },
] as const;

export function AboutScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'right', 'bottom', 'left']}>
      <ScannerHeader action="back" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Image
            source={require('../../../assets/tmc-seal.png')}
            accessibilityLabel="Trinidad Municipal College seal"
            resizeMode="contain"
            style={styles.logo}
          />
          <View style={styles.heroText}>
            <Text style={styles.eyebrow}>ABOUT THE APPLICATION</Text>
            <Text style={styles.title}>TMC Scanner</Text>
            <Text style={styles.subtitle}>Entrance Examination Scoring System</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeading}>
            <Ionicons name="information-circle-outline" color={colors.gold} size={22} />
            <Text style={styles.sectionTitle}>App Information</Text>
          </View>
          <Text style={styles.bodyText}>
            TMC Scanner helps authorized examination staff capture OMR answer sheets, identify
            applicants, process responses, review scores, and file results in the TMC Admin Portal.
          </Text>
          <View style={styles.versionRow}>
            <Text style={styles.versionLabel}>Application version</Text>
            <Text style={styles.versionValue}>1.0.0</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeading}>
            <Ionicons name="map-outline" color={colors.gold} size={22} />
            <Text style={styles.sectionTitle}>How to Use the App</Text>
          </View>
          <View style={styles.steps}>
            {WORKFLOW.map((step, index) => (
              <View key={step.title} style={styles.stepRow}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{index + 1}</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepDescription}>{step.description}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeading}>
            <Ionicons name="bulb-outline" color={colors.gold} size={22} />
            <Text style={styles.sectionTitle}>Scanning Tips</Text>
          </View>
          <View style={styles.tipList}>
            <Tip text="Keep the entire sheet flat and visible inside the camera frame." />
            <Tip text="Use bright, even lighting and avoid shadows or glare." />
            <Tip text="Hold the phone parallel to the sheet and keep it steady." />
            <Tip text="Check that the applicant details are correct before processing." />
            <Tip text="Keep the app open while the answer sheet is being uploaded and scored." />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeading}>
            <Ionicons name="people-outline" color={colors.gold} size={22} />
            <Text style={styles.sectionTitle}>Capstone Team</Text>
          </View>
          <View style={styles.teamList}>
            {TEAM.map((member) => (
              <View key={member.name} style={styles.memberRow}>
                <View style={styles.memberIcon}>
                  <Ionicons name="person-outline" color={colors.navy} size={18} />
                </View>
                <View style={styles.memberText}>
                  <Text style={styles.memberName}>{member.name}</Text>
                  <Text style={styles.memberRole}>{member.role}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerTitle}>Code Nexus</Text>
          <Text style={styles.footerText}>Developed for Trinidad Municipal College</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Tip({ text }: { text: string }) {
  return (
    <View style={styles.tipRow}>
      <Ionicons name="checkmark-circle" color={colors.gold} size={18} />
      <Text style={styles.tipText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 36,
    gap: 14,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 4,
    paddingBottom: 2,
  },
  logo: {
    width: 68,
    height: 68,
  },
  heroText: {
    flex: 1,
  },
  eyebrow: {
    color: colors.gold,
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  title: {
    color: colors.navy,
    fontSize: 25,
    lineHeight: 31,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
    padding: 17,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 12,
  },
  sectionTitle: {
    flex: 1,
    color: colors.navy,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '800',
  },
  bodyText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 21,
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    borderRadius: 9,
    backgroundColor: colors.input,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  versionLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  versionValue: {
    color: colors.navy,
    fontSize: 12,
    fontWeight: '800',
  },
  steps: {
    gap: 15,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: colors.goldSoft,
  },
  stepNumberText: {
    color: colors.navy,
    fontSize: 12,
    fontWeight: '800',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    color: colors.navy,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  stepDescription: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  tipList: {
    gap: 10,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  tipText: {
    flex: 1,
    color: colors.text,
    fontSize: 12,
    lineHeight: 18,
  },
  teamList: {
    gap: 8,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderRadius: 10,
    backgroundColor: colors.input,
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  memberIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: colors.goldSoft,
  },
  memberText: {
    flex: 1,
  },
  memberName: {
    color: colors.navy,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  memberRole: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
  },
  footer: {
    alignItems: 'center',
    paddingTop: 5,
  },
  footerTitle: {
    color: colors.navy,
    fontSize: 13,
    fontWeight: '800',
  },
  footerText: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 17,
  },
});
