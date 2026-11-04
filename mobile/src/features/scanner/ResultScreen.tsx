import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthContext';
import { formatApplicantId } from '@/features/scanner/applicantId';
import { ScannerHeader } from '@/features/scanner/ScannerHeader';
import { ScannerProgress } from '@/features/scanner/ScannerProgress';
import { useScannerWorkflow } from '@/features/scanner/ScannerWorkflowContext';
import { ApiError, apiRequest } from '@/lib/api';
import { colors } from '@/theme/colors';

type SchoolYearFolder = {
  id: number;
  school_year: string;
  course?: string;
  status: 'Active' | 'Archived';
};

type ExaminationResult = {
  id: number;
  score: string | number;
  status: 'Passed' | 'Failed';
  total_items: number;
  correct_count: number;
  incorrect_count: number;
  passing_score: string | number;
};

type ResultApplicant = {
  id: number;
  applicant_name: string;
  examination_date: string;
  course: string;
  folder_id: number | null;
  filed_at: string | null;
  folder: SchoolYearFolder | null;
};

type JobStatusResponse = {
  job: {
    id: number;
    status: 'Queued' | 'Processing' | 'Completed' | 'Failed';
  };
  result: ExaminationResult | null;
  applicant: ResultApplicant;
};

type FilingResponse = {
  message: string;
  applicant: ResultApplicant;
  result: ExaminationResult;
};

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

function formatExaminationDate(value?: string | null): string {
  if (!value) {
    return '—';
  }

  const [year, month, day] = value.slice(0, 10).split('-').map(Number);

  if (!year || !month || !day) {
    return value;
  }

  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

function scoreLabel(score: string | number): string {
  return `${Math.round(Number(score))}%`;
}

export function ResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ jobId?: string | string[] }>();
  const jobId = Array.isArray(params.jobId) ? params.jobId[0] : params.jobId;
  const { token } = useAuth();
  const { clearWorkflow } = useScannerWorkflow();

  const [result, setResult] = useState<ExaminationResult | null>(null);
  const [applicant, setApplicant] = useState<ResultApplicant | null>(null);
  const [folders, setFolders] = useState<SchoolYearFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [isFolderPickerVisible, setIsFolderPickerVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadResult() {
      if (!jobId || !token) {
        setErrorMessage('The processing job for this result is unavailable. Please scan again.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const [jobResponse, folderList] = await Promise.all([
          apiRequest<JobStatusResponse>(`/omr-jobs/${jobId}`, {
            method: 'GET',
            token,
          }),
          apiRequest<SchoolYearFolder[]>('/folders?status=Active', {
            method: 'GET',
            token,
          }).catch(() => [] as SchoolYearFolder[]),
        ]);

        if (cancelled) {
          return;
        }

        if (jobResponse.job.status !== 'Completed' || !jobResponse.result) {
          setErrorMessage('This answer sheet has not finished processing yet. Check again shortly.');
          return;
        }

        setResult(jobResponse.result);
        setApplicant(jobResponse.applicant);
        setFolders(folderList);

        if (jobResponse.applicant.filed_at !== null) {
          setSelectedFolderId(jobResponse.applicant.folder_id);
          setSavedMessage('Successfully Saved To Admin Portal');
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof ApiError
              ? error.message
              : 'The examination result could not be loaded. Please try again.',
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadResult();

    return () => {
      cancelled = true;
    };
  }, [jobId, token]);

  const selectedFolder =
    folders.find((folder) => folder.id === selectedFolderId) ?? applicant?.folder ?? null;
  const isFiled = savedMessage !== null;
  const canSave =
    !isFiled && !isSaving && selectedFolderId !== null && result !== null && folders.length > 0;

  async function saveToAdminPortal() {
    if (!token || !result || selectedFolderId === null || isFiled) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const response = await apiRequest<FilingResponse>(`/results/${result.id}/file`, {
        method: 'POST',
        body: JSON.stringify({ folder_id: selectedFolderId }),
        token,
      });

      setApplicant(response.applicant);
      setResult(response.result);
      setSavedMessage(response.message);
      setIsFolderPickerVisible(false);
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : 'The result could not be saved to the admin portal. Please try again.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  function scanAnotherSheet() {
    clearWorkflow();
    router.replace('/');
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'right', 'bottom', 'left']}>
        <ScannerHeader />
        <ScannerProgress step={4} />
        <View style={styles.centered}>
          <ActivityIndicator color={colors.gold} size="large" />
          <Text style={styles.loadingText}>Loading examination result…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!result || !applicant) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'right', 'bottom', 'left']}>
        <ScannerHeader />
        <ScannerProgress step={4} />
        <View style={styles.centered}>
          <View style={styles.errorBox}>
            <Ionicons name="warning-outline" color={colors.danger} size={18} />
            <Text style={styles.errorText}>
              {errorMessage ?? 'The examination result is unavailable.'}
            </Text>
          </View>
          <Pressable
            onPress={scanAnotherSheet}
            accessibilityRole="button"
            accessibilityLabel="Back to Scanner Home"
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Back to Scanner Home</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const score = Number(result.score);
  const isPassed = result.status === 'Passed';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'right', 'bottom', 'left']}>
      <ScannerHeader />
      <ScannerProgress step={4} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.contentWidth}>
          <View style={styles.resultCard}>
            <Text style={styles.title}>Examination Result</Text>

            <View style={styles.applicantCard}>
              <Text style={styles.applicantLabel}>APPLICANT</Text>
              <Text style={styles.applicantName}>{applicant.applicant_name}</Text>
              <Text style={styles.applicantId}>{formatApplicantId(applicant.id)}</Text>
              <Text style={styles.examinationDate}>
                Examination Date: {formatExaminationDate(applicant.examination_date)}
              </Text>
            </View>

            <View style={styles.scoreCircle}>
              <Text style={styles.scoreValue}>{scoreLabel(score)}</Text>
            </View>

            <View style={[styles.statusPill, isPassed ? styles.passedPill : styles.failedPill]}>
              <Text style={[styles.statusPillText, isPassed ? styles.passedText : styles.failedText]}>
                {result.status}
              </Text>
            </View>

            <View style={styles.stats}>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Correct Answers</Text>
                <Text style={styles.statValue}>{result.correct_count}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Incorrect Answers</Text>
                <Text style={styles.statValue}>{result.incorrect_count}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Total Items</Text>
                <Text style={styles.statValue}>{result.total_items}</Text>
              </View>
              <View style={[styles.statRow, styles.lastStatRow]}>
                <Text style={styles.statLabel}>Result</Text>
                <Text style={[styles.statValue, isPassed ? styles.passedText : styles.failedText]}>
                  {result.status}
                </Text>
              </View>
            </View>

            <View style={styles.fileDivider}>
              <View style={styles.dividerLine} />
              <Text style={styles.fileDividerText}>SAVE TO ADMIN PORTAL</Text>
              <View style={styles.dividerLine} />
            </View>

            <Text style={styles.folderLabel}>SCHOOL YEAR FOLDER</Text>

            {savedMessage ? (
              <View style={styles.successBox}>
                <Ionicons name="checkmark-circle" color="#047857" size={20} />
                <View style={styles.successTextWrap}>
                  <Text style={styles.successText}>{savedMessage}</Text>
                  {selectedFolder ? (
                    <Text style={styles.successFolder}>{selectedFolder.school_year}</Text>
                  ) : null}
                </View>
              </View>
            ) : (
              <>
                <Pressable
                  onPress={() => {
                    if (folders.length > 0) {
                      setIsFolderPickerVisible(true);
                    }
                  }}
                  disabled={folders.length === 0}
                  accessibilityRole="button"
                  accessibilityLabel="Choose school year folder"
                  style={({ pressed }) => [
                    styles.folderSelector,
                    folders.length === 0 && styles.folderSelectorDisabled,
                    pressed && styles.folderSelectorPressed,
                  ]}
                >
                  <View style={styles.folderSelectorLabel}>
                    <Ionicons name="folder-outline" color={colors.gold} size={19} />
                    <Text style={styles.folderSelectorText}>
                      {selectedFolder
                        ? `${selectedFolder.school_year} — Current`
                        : 'Select school year folder'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" color={colors.navy} size={18} />
                </Pressable>

                <Text style={styles.folderHelp}>
                  {folders.length === 0
                    ? 'No active school year folders are available. Ask an administrator to create one first.'
                    : 'Choose the active school year where this result will be filed.'}
                </Text>

                {folders.length === 0 ? (
                  <Pressable
                    onPress={scanAnotherSheet}
                    accessibilityRole="button"
                    accessibilityLabel="Return to Scanner Home"
                    style={({ pressed }) => [
                      styles.returnButton,
                      pressed && styles.returnButtonPressed,
                    ]}
                  >
                    <Text style={styles.returnButtonText}>Return to Scanner Home</Text>
                  </Pressable>
                ) : null}
              </>
            )}

            {errorMessage ? (
              <View style={styles.errorBox}>
                <Ionicons name="warning-outline" color={colors.danger} size={18} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {isFiled ? (
          <Pressable
            onPress={scanAnotherSheet}
            accessibilityRole="button"
            accessibilityLabel="Scan Another Sheet"
            style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
          >
            <Ionicons name="scan-outline" color={colors.navy} size={19} />
            <Text style={styles.primaryButtonText}>Scan Another Sheet</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => void saveToAdminPortal()}
            disabled={!canSave}
            accessibilityRole="button"
            accessibilityLabel="Save to Admin Portal"
            style={({ pressed }) => [
              styles.primaryButton,
              !canSave && styles.primaryButtonDisabled,
              pressed && canSave && styles.primaryButtonPressed,
            ]}
          >
            {isSaving ? <ActivityIndicator color={colors.navy} size="small" /> : null}
            <Text style={styles.primaryButtonText}>
              {isSaving ? 'Saving…' : 'Save to Admin Portal'}
            </Text>
          </Pressable>
        )}
      </View>

      <Modal
        animationType="fade"
        transparent
        visible={isFolderPickerVisible}
        onRequestClose={() => setIsFolderPickerVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            onPress={() => setIsFolderPickerVisible(false)}
            accessibilityRole="button"
            accessibilityLabel="Close folder picker"
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.modalCard} accessibilityViewIsModal>
            <Text style={styles.modalTitle}>School Year Folder</Text>
            <Text style={styles.modalSubtitle}>Only active folders can receive results.</Text>

            <ScrollView style={styles.folderList} showsVerticalScrollIndicator={false}>
              {folders.map((folder) => {
                const selected = folder.id === selectedFolderId;

                return (
                  <Pressable
                    key={folder.id}
                    onPress={() => {
                      setSelectedFolderId(folder.id);
                      setIsFolderPickerVisible(false);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Select ${folder.school_year}`}
                    style={({ pressed }) => [
                      styles.folderOption,
                      selected && styles.folderOptionSelected,
                      pressed && styles.folderOptionPressed,
                    ]}
                  >
                    <View style={styles.folderOptionLabel}>
                      <Ionicons name="folder-outline" color={colors.gold} size={19} />
                      <View>
                        <Text style={styles.folderOptionText}>{folder.school_year}</Text>
                        <Text style={styles.folderOptionStatus}>Current</Text>
                      </View>
                    </View>
                    {selected ? (
                      <Ionicons name="checkmark-circle" color={colors.navy} size={20} />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable
              onPress={() => setIsFolderPickerVisible(false)}
              accessibilityRole="button"
              accessibilityLabel="Cancel folder selection"
              style={({ pressed }) => [styles.cancelButton, pressed && styles.cancelButtonPressed]}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: { color: colors.muted, fontSize: 13, marginTop: 12 },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  contentWidth: { width: '100%', maxWidth: 470 },
  resultCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    backgroundColor: colors.surface,
    padding: 18,
  },
  title: {
    color: colors.navy,
    fontSize: 23,
    lineHeight: 30,
    fontWeight: '800',
    textAlign: 'center',
  },
  applicantCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.input,
    padding: 13,
    marginTop: 17,
  },
  applicantLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  applicantName: {
    color: colors.navy,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4,
  },
  applicantId: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  examinationDate: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 7,
  },
  scoreCircle: {
    width: 150,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    borderRadius: 75,
    borderWidth: 12,
    borderColor: colors.goldSoft,
    backgroundColor: colors.surface,
    marginTop: 20,
  },
  scoreValue: {
    color: colors.navy,
    fontSize: 32,
    fontWeight: '800',
  },
  statusPill: {
    alignSelf: 'center',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginTop: 12,
  },
  passedPill: { backgroundColor: '#D9F3E5' },
  failedPill: { backgroundColor: colors.dangerBackground },
  statusPillText: { fontSize: 12, fontWeight: '800' },
  passedText: { color: '#047857' },
  failedText: { color: colors.danger },
  stats: { marginTop: 17 },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingVertical: 10,
  },
  lastStatRow: { borderBottomWidth: 0 },
  statLabel: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  statValue: { color: colors.navy, fontSize: 13, fontWeight: '800' },
  fileDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 17,
  },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  fileDividerText: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  folderLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 17,
    marginBottom: 8,
  },
  folderSelector: {
    minHeight: 55,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
  },
  folderSelectorPressed: { backgroundColor: colors.input },
  folderSelectorDisabled: { opacity: 0.55 },
  folderSelectorLabel: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
  folderSelectorText: { flex: 1, color: colors.navy, fontSize: 13, fontWeight: '700' },
  folderHelp: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 7 },
  returnButton: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 9,
    marginTop: 12,
  },
  returnButtonPressed: { backgroundColor: colors.input },
  returnButtonText: { color: colors.navy, fontSize: 12, fontWeight: '700' },
  successBox: {
    flexDirection: 'row',
    gap: 9,
    borderRadius: 10,
    backgroundColor: '#E7F6EE',
    padding: 12,
  },
  successTextWrap: { flex: 1 },
  successText: { color: '#047857', fontSize: 13, fontWeight: '800' },
  successFolder: { color: '#047857', fontSize: 11, marginTop: 2 },
  errorBox: {
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: 9,
    backgroundColor: colors.dangerBackground,
    padding: 11,
    marginTop: 13,
  },
  errorText: { flex: 1, color: colors.danger, fontSize: 12, lineHeight: 17 },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  primaryButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderRadius: 10,
    backgroundColor: colors.gold,
    paddingHorizontal: 18,
  },
  primaryButtonPressed: { opacity: 0.84 },
  primaryButtonDisabled: { opacity: 0.45 },
  primaryButtonText: { color: colors.navy, fontSize: 14, fontWeight: '800' },
  modalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 33, 63, 0.48)',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    backgroundColor: colors.surface,
    padding: 20,
    elevation: 8,
  },
  modalTitle: { color: colors.navy, fontSize: 20, fontWeight: '800' },
  modalSubtitle: { color: colors.muted, fontSize: 12, marginTop: 3 },
  folderList: { maxHeight: 300, marginTop: 14 },
  folderOption: {
    minHeight: 57,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  folderOptionSelected: { borderColor: colors.gold, backgroundColor: colors.input },
  folderOptionPressed: { backgroundColor: colors.input },
  folderOptionLabel: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
  folderOptionText: { color: colors.navy, fontSize: 13, fontWeight: '700' },
  folderOptionStatus: { color: colors.muted, fontSize: 10, marginTop: 1 },
  cancelButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 9,
    marginTop: 6,
  },
  cancelButtonPressed: { backgroundColor: colors.input },
  cancelButtonText: { color: colors.navy, fontSize: 13, fontWeight: '700' },
});
