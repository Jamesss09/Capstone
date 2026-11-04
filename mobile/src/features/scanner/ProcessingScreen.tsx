import { Ionicons } from '@expo/vector-icons';
import { File } from 'expo-file-system';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthContext';
import { ScannerHeader } from '@/features/scanner/ScannerHeader';
import { ScannerProgress } from '@/features/scanner/ScannerProgress';
import { useScannerWorkflow } from '@/features/scanner/ScannerWorkflowContext';
import { formatApplicantId } from '@/features/scanner/applicantId';
import { ApiError, apiRequest, apiUploadFile } from '@/lib/api';
import { colors } from '@/theme/colors';

type JobStatus = 'Queued' | 'Processing' | 'Completed' | 'Failed';

type UploadResponse = {
  applicant: {
    id: number;
  };
  job: {
    id: number;
  };
};

type JobStatusResponse = {
  job: {
    id: number;
    status: JobStatus;
    error_message?: string | null;
  };
};

const BUBBLE_ROWS = [
  [0, 1, 0, 0],
  [0, 0, 1, 0],
  [0, 0, 0, 1],
  [0, 1, 0, 0],
  [0, 0, 1, 0],
  [0, 0, 0, 1],
  [0, 1, 0, 0],
] as const;

export function ProcessingScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const {
    applicant,
    applicantDraft,
    photo,
    setApplicant,
    source,
    submissionId,
  } = useScannerWorkflow();
  const photoUri = photo?.uri ?? null;
  const photoMimeType = photo?.mimeType ?? 'image/jpeg';
  const applicantId = applicant ? String(applicant.id) : null;
  const applicantCode = applicant?.code ?? 'Generating…';
  const hasStartedRef = useRef(false);
  const isMountedRef = useRef(true);
  const [status, setStatus] = useState<JobStatus>('Queued');
  const [jobId, setJobId] = useState<number | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Track true unmount only. The upload effect must not be cancelled when
  // setApplicant changes the workflow context and re-renders this screen.
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (hasStartedRef.current) {
      return;
    }

    hasStartedRef.current = true;

    async function uploadAndMonitor() {
      if (!photoUri || (!applicantId && !applicantDraft) || !token) {
        setErrorMessage('The photo or applicant session is unavailable. Please start again.');
        return;
      }

      let requestStage = 'uploading the answer sheet';

      try {
        const imageFile = new File(photoUri);

        if (!imageFile.exists || imageFile.size === 0) {
          throw new ApiError('The selected answer sheet image is unavailable or empty.', 0);
        }

        const parameters: Record<string, string> = applicantId
          ? { applicant_id: applicantId }
          : {
              submission_uuid: submissionId,
              applicant_name: applicantDraft!.applicantName,
              examination_date: applicantDraft!.examinationDate,
              mobile_number: applicantDraft!.mobileNumber,
              student_type: applicantDraft!.studentType,
              course: applicantDraft!.course,
            };
        const upload = await apiUploadFile<UploadResponse>('/sheets/upload', imageFile, {
          fieldName: 'image',
          mimeType: photoMimeType || imageFile.type || 'image/jpeg',
          parameters,
          token,
        });

        if (!isMountedRef.current) {
          return;
        }

        setApplicant({
          id: upload.applicant.id,
          code: formatApplicantId(upload.applicant.id),
        });
        setJobId(upload.job.id);
        requestStage = 'checking processing status';

        for (let attempt = 0; attempt < 120; attempt += 1) {
          const response = await apiRequest<JobStatusResponse>(`/omr-jobs/${upload.job.id}`, {
            method: 'GET',
            token,
          });

          if (!isMountedRef.current) {
            return;
          }

          setStatus(response.job.status);

          if (response.job.status === 'Completed') {
            setIsComplete(true);
            return;
          }

          if (response.job.status === 'Failed') {
            setErrorMessage(response.job.error_message ?? 'OMR processing failed. Please recapture the sheet.');
            return;
          }

          await new Promise<void>((resolve) => setTimeout(resolve, 1500));
        }

        setErrorMessage('Processing is taking longer than expected. Please check the result later.');
      } catch (error) {
        if (isMountedRef.current) {
          setErrorMessage(
            error instanceof ApiError
              ? `${requestStage}: ${error.message}`
              : `Error while ${requestStage}. Please try again.`,
          );
        }
      }
    }

    void uploadAndMonitor();
  }, [applicantDraft, applicantId, photoMimeType, photoUri, setApplicant, submissionId, token]);

  const statusText = errorMessage
    ? 'Processing could not be completed.'
    : isComplete
      ? 'Answer sheet processed.'
      : status === 'Queued'
        ? 'Waiting for the OMR queue...'
        : 'Detecting answer bubbles...';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'right', 'bottom', 'left']}>
      <ScannerHeader action="back" onBack={() => router.back()} />
      <ScannerProgress step={3} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.contentWidth}>
          <Text style={styles.title}>Processing</Text>
          <Text style={styles.subtitle}>
            {errorMessage ? 'Review the scan and try again.' : 'Analyzing the answer sheet...'}
          </Text>

          <View style={styles.applicantCard}>
            <Text style={styles.applicantLabel}>APPLICANT ID</Text>
            <Text style={styles.applicantCode}>{applicantCode}</Text>
            {jobId !== null ? <Text style={styles.jobText}>Processing job #{jobId}</Text> : null}
          </View>

          <View style={styles.bubbleCard}>
            {BUBBLE_ROWS.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.bubbleRow}>
                <Text style={styles.rowNumber}>{String(rowIndex + 1).padStart(2, '0')}</Text>
                {row.map((filled, bubbleIndex) => (
                  <View
                    key={bubbleIndex}
                    style={[styles.bubble, filled === 1 && styles.bubbleFilled]}
                  />
                ))}
              </View>
            ))}
          </View>

          <Text style={styles.statusText}>{statusText}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, isComplete && styles.progressFillComplete]} />
          </View>

          {errorMessage ? (
            <View style={styles.errorBox}>
              <Ionicons name="warning-outline" color={colors.danger} size={18} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : isComplete ? (
            <View style={styles.completeBox}>
              <Ionicons name="checkmark-circle-outline" color={colors.navy} size={18} />
              <Text style={styles.completeText}>
                The score is ready. Review it and save it to an admin folder.
              </Text>
            </View>
          ) : (
            <ActivityIndicator color={colors.gold} size="small" style={styles.spinner} />
          )}

          {isComplete && jobId !== null ? (
            <Pressable
              onPress={() =>
                router.replace({
                  pathname: '/result',
                  params: { jobId: String(jobId) },
                })
              }
              accessibilityRole="button"
              accessibilityLabel="View Result"
              style={({ pressed }) => [
                styles.viewResultButton,
                pressed && styles.viewResultButtonPressed,
              ]}
            >
              <Text style={styles.viewResultButtonText}>View Result</Text>
              <Ionicons name="arrow-forward" color={colors.navy} size={18} />
            </Pressable>
          ) : null}

          {errorMessage ? (
            <Pressable
              onPress={() => {
                router.replace(source === 'upload' ? '/upload' : '/capture');
              }}
              accessibilityRole="button"
              accessibilityLabel="Recapture answer sheet"
              style={styles.retryButton}
            >
              <Text style={styles.retryButtonText}>Recapture Answer Sheet</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },
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
  applicantCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
    backgroundColor: colors.input,
    padding: 12,
    marginTop: 16,
  },
  applicantLabel: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  applicantCode: { color: colors.navy, fontSize: 18, fontWeight: '800', marginTop: 3 },
  jobText: { color: colors.muted, fontSize: 10, marginTop: 3 },
  bubbleCard: {
    gap: 11,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
    padding: 16,
    marginTop: 14,
  },
  bubbleRow: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  rowNumber: { width: 18, color: colors.muted, fontFamily: 'monospace', fontSize: 10 },
  bubble: {
    width: 16,
    height: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  bubbleFilled: { borderColor: '#B83C31', backgroundColor: '#B83C31' },
  statusText: { color: colors.muted, fontFamily: 'monospace', fontSize: 12, textAlign: 'center', marginTop: 18 },
  progressTrack: { height: 5, overflow: 'hidden', borderRadius: 3, backgroundColor: colors.border, marginTop: 10 },
  progressFill: { width: '62%', height: '100%', borderRadius: 3, backgroundColor: colors.gold },
  progressFillComplete: { width: '100%', backgroundColor: colors.navy },
  spinner: { marginTop: 16 },
  errorBox: {
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: 9,
    backgroundColor: colors.dangerBackground,
    padding: 11,
    marginTop: 16,
  },
  errorText: { flex: 1, color: colors.danger, fontSize: 12, lineHeight: 17 },
  completeBox: {
    flexDirection: 'row',
    gap: 8,
    borderRadius: 9,
    backgroundColor: colors.goldSoft,
    padding: 11,
    marginTop: 16,
  },
  completeText: { flex: 1, color: colors.navy, fontSize: 12, lineHeight: 17 },
  viewResultButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
    backgroundColor: colors.gold,
    marginTop: 15,
  },
  viewResultButtonPressed: { opacity: 0.84 },
  viewResultButtonText: { color: colors.navy, fontSize: 14, fontWeight: '800' },
  retryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: colors.gold,
    marginTop: 15,
  },
  retryButtonText: { color: colors.navy, fontSize: 14, fontWeight: '800' },
});
