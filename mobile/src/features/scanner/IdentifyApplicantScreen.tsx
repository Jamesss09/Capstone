import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthContext';
import { ScannerHeader } from '@/features/scanner/ScannerHeader';
import { ScannerProgress } from '@/features/scanner/ScannerProgress';
import { useScannerWorkflow } from '@/features/scanner/ScannerWorkflowContext';
import { colors } from '@/theme/colors';

const APPLICANT_TYPES = [
  { label: 'Freshman', value: 'NEW' },
  { label: 'Transferee', value: 'TRANSFEREE' },
  { label: 'Old Student', value: 'OLD' },
  { label: 'Returnee', value: 'RETURNEE' },
] as const;

const COURSES = ['BSIT', 'BA POLSCI', 'BEED', 'BSED', 'BSCRIM', 'BSOA'] as const;

type ApplicantType = (typeof APPLICANT_TYPES)[number]['value'];
type Course = (typeof COURSES)[number];

function formatDateDigits(digits: string): string {
  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function formatDateInput(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}/${day}/${date.getFullYear()}`;
}

function parseDateInput(value: string): Date | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());

  if (!match) {
    return null;
  }

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function toApiDate(value: string): string | null {
  const parsed = parseDateInput(value);

  if (!parsed) {
    return null;
  }

  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${parsed.getFullYear()}-${month}-${day}`;
}

export function IdentifyApplicantScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { applicantDraft, photo, setApplicantDraft } = useScannerWorkflow();
  const photoUri = photo?.uri ?? null;
  const initialDate = applicantDraft
    ? `${applicantDraft.examinationDate.slice(5, 7)}/${applicantDraft.examinationDate.slice(8, 10)}/${applicantDraft.examinationDate.slice(0, 4)}`
    : '';
  const [fullName, setFullName] = useState(applicantDraft?.applicantName ?? '');
  const [mobileNumber, setMobileNumber] = useState(applicantDraft?.mobileNumber ?? '');
  const [applicantType, setApplicantType] = useState<ApplicantType>(
    applicantDraft?.studentType ?? 'NEW',
  );
  const [course, setCourse] = useState<Course | null>((applicantDraft?.course as Course) ?? null);
  const [dateInput, setDateInput] = useState(initialDate);
  const [dateValue, setDateValue] = useState<Date | null>(parseDateInput(initialDate));
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function clearError() {
    setErrorMessage(null);
  }

  function validate(): string | null {
    if (!photoUri) {
      return 'The selected photo is no longer available. Please choose it again.';
    }

    if (!fullName.trim()) {
      return 'Enter the applicant’s full name.';
    }

    if (!toApiDate(dateInput)) {
      return 'Enter a valid examination date.';
    }

    if (mobileNumber.trim() && !/^\d{7,15}$/.test(mobileNumber.trim())) {
      return 'Enter a valid mobile number or leave it blank.';
    }

    if (!course) {
      return 'Select the course to enroll in.';
    }

    if (!token) {
      return 'Your staff session has expired. Please sign in again.';
    }

    return null;
  }

  function continueToProcessing() {
    const validationMessage = validate();

    if (validationMessage) {
      setErrorMessage(validationMessage);
      return;
    }

    const examinationDate = toApiDate(dateInput);

    if (!token || !course || !examinationDate) {
      return;
    }

    setErrorMessage(null);
    setApplicantDraft({
      applicantName: fullName.trim(),
      examinationDate,
      mobileNumber: mobileNumber.trim(),
      studentType: applicantType,
      course,
    });
    router.push('/processing');
  }

  function handleDateChange(event: DateTimePickerEvent, selectedDate?: Date) {
    setIsDatePickerVisible(false);

    if (event.type !== 'set' || !selectedDate) {
      return;
    }

    setDateValue(selectedDate);
    setDateInput(formatDateInput(selectedDate));
    clearError();
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'right', 'bottom', 'left']}>
      <ScannerHeader action="back" onBack={() => router.back()} />
      <ScannerProgress step={2} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.contentWidth}>
            <Text style={styles.title}>Identify Applicant</Text>
            <Text style={styles.subtitle}>
              Link this scanned sheet to an applicant before saving.
            </Text>

            <View style={styles.formCard}>
              <Text style={styles.fieldLabel}>FULL NAME <Text style={styles.required}>*</Text></Text>
              <TextInput
                value={fullName}
                onChangeText={(value) => {
                  setFullName(value);
                  clearError();
                }}
                accessibilityLabel="Full Name"
                autoCapitalize="words"
                placeholder="Enter full name"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
              <Text style={styles.helperText}>This is the primary link between the sheet and the applicant.</Text>

              <Text style={styles.fieldLabel}>EXAMINATION DATE <Text style={styles.required}>*</Text></Text>
              <View style={styles.inputWithIcon}>
                <TextInput
                  value={dateInput}
                  onChangeText={(value) => {
                    const digits = value.replace(/\D/g, '').slice(0, 8);
                    setDateInput(formatDateDigits(digits));
                    setDateValue(parseDateInput(formatDateDigits(digits)));
                    clearError();
                  }}
                  accessibilityLabel="Exam Date"
                  autoCapitalize="none"
                  keyboardType="number-pad"
                  placeholder="MM/DD/YYYY"
                  placeholderTextColor={colors.muted}
                  style={styles.inputText}
                />
                <Pressable
                  onPress={() => setIsDatePickerVisible(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Open calendar"
                  hitSlop={8}
                >
                  <Ionicons name="calendar-outline" color={colors.navy} size={17} />
                </Pressable>
              </View>
              <Text style={styles.helperText}>Date when the applicant took the entrance examination.</Text>
              {isDatePickerVisible ? (
                <DateTimePicker
                  mode="date"
                  value={dateValue ?? new Date()}
                  display={Platform.OS === 'android' ? 'calendar' : 'spinner'}
                  onChange={handleDateChange}
                />
              ) : null}

              <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>MOBILE NO.</Text>
                <Text style={styles.optionalBadge}>Optional</Text>
              </View>
              <TextInput
                value={mobileNumber}
                onChangeText={(value) => {
                  setMobileNumber(value.replace(/\D/g, '').slice(0, 15));
                  clearError();
                }}
                accessibilityLabel="Mobile Number (Optional)"
                keyboardType="phone-pad"
                placeholder="09XX XXX XXXX"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
              <Text style={styles.helperText}>Use this to tell apart two applicants who share the same name.</Text>

              <Text style={styles.fieldLabel}>APPLICANT TYPE</Text>
              <View style={styles.optionGrid}>
                {APPLICANT_TYPES.map((option) => (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      setApplicantType(option.value);
                      clearError();
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: applicantType === option.value }}
                    accessibilityLabel={option.value}
                    style={[styles.option, applicantType === option.value && styles.optionSelected]}
                  >
                    <Text style={[styles.optionText, applicantType === option.value && styles.optionTextSelected]}>
                      {option.value}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.fieldLabel}>COURSE TO ENROLL <Text style={styles.required}>*</Text></Text>
              <View style={styles.optionGrid}>
                {COURSES.map((courseOption) => (
                  <Pressable
                    key={courseOption}
                    onPress={() => {
                      setCourse(courseOption);
                      clearError();
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: course === courseOption }}
                    accessibilityLabel={courseOption}
                    style={[styles.option, course === courseOption && styles.optionSelected]}
                  >
                    <Text style={[styles.optionText, course === courseOption && styles.optionTextSelected]}>
                      {courseOption}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.helperText}>The program the applicant is taking the entrance exam for.</Text>

              <View style={styles.infoBox}>
                <Ionicons name="information-circle-outline" color={colors.gold} size={17} />
                <Text style={styles.infoText}>
                  The Applicant ID will be generated after the answer sheet is uploaded successfully.
                </Text>
              </View>
            </View>

            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

            <Pressable
              onPress={continueToProcessing}
              accessibilityRole="button"
              accessibilityLabel="Continue to processing"
              style={({ pressed }) => [
                styles.submitButton,
                pressed && styles.submitButtonPressed,
              ]}
            >
              <Text style={styles.submitButtonText}>Continue to Processing</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },
  keyboardView: { flex: 1 },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 30,
  },
  contentWidth: { width: '100%', maxWidth: 470 },
  title: { color: colors.navy, fontSize: 23, lineHeight: 30, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 3 },
  formCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 13,
    backgroundColor: colors.surface,
    padding: 17,
    marginTop: 16,
  },
  fieldLabel: { color: colors.navy, fontSize: 11, fontWeight: '800', letterSpacing: 0.35, marginTop: 14 },
  required: { color: colors.danger },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 14 },
  optionalBadge: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    borderRadius: 6,
    backgroundColor: colors.goldSoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 9,
    backgroundColor: colors.input,
    color: colors.navy,
    fontSize: 14,
    paddingHorizontal: 13,
    marginTop: 7,
  },
  inputWithIcon: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 9,
    backgroundColor: colors.input,
    paddingRight: 13,
    marginTop: 7,
  },
  inputText: { flex: 1, color: colors.navy, fontSize: 14, paddingHorizontal: 13 },
  helperText: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 5 },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  option: {
    minHeight: 42,
    minWidth: '22%',
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 9,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
  },
  optionSelected: { borderColor: colors.gold, backgroundColor: colors.goldSoft },
  optionText: { color: colors.navy, fontSize: 12, fontWeight: '700' },
  optionTextSelected: { fontWeight: '800' },
  infoBox: {
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    borderColor: '#F3D59C',
    borderRadius: 9,
    backgroundColor: '#FFF7E8',
    padding: 11,
    marginTop: 16,
  },
  infoText: { flex: 1, color: colors.muted, fontSize: 11, lineHeight: 16 },
  generatedCard: {
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: 12,
    backgroundColor: colors.goldSoft,
    padding: 15,
    marginTop: 14,
  },
  generatedLabel: { color: colors.navy, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  generatedId: { color: colors.navy, fontSize: 26, fontWeight: '800', marginTop: 5 },
  generatedHint: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 4 },
  errorText: { color: colors.danger, fontSize: 12, lineHeight: 18, marginTop: 10 },
  submitButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: colors.navy,
    marginTop: 17,
  },
  submitButtonPressed: { backgroundColor: colors.navyPressed },
  submitButtonText: { color: colors.surface, fontSize: 14, fontWeight: '800' },
  disabledButton: { opacity: 0.6 },
  continueButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.navy,
    borderRadius: 10,
    backgroundColor: colors.surface,
    marginTop: 10,
  },
  continueButtonPressed: { backgroundColor: colors.input },
  continueButtonText: { color: colors.navy, fontSize: 14, fontWeight: '800' },
});
