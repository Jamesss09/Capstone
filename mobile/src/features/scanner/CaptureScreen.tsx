import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useIsFocused, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { CameraView as CameraViewInstance } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScannerHeader } from '@/features/scanner/ScannerHeader';
import { ScannerProgress } from '@/features/scanner/ScannerProgress';
import { useScannerWorkflow } from '@/features/scanner/ScannerWorkflowContext';
import { persistAnswerSheetPhoto } from '@/features/scanner/answerSheetPhoto';
import { colors } from '@/theme/colors';

export function CaptureScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { applicant, applicantDraft, setPhoto, setSource } = useScannerWorkflow();
  const cameraRef = useRef<CameraViewInstance>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const canRequestPermission = permission?.canAskAgain ?? true;
  const canCapture = Boolean(
    isFocused &&
      permission?.granted &&
      isCameraReady &&
      !isCapturing &&
      !cameraError,
  );

  async function askForCameraPermission() {
    try {
      setCameraError(null);
      await requestPermission();
    } catch {
      setCameraError('Camera permission could not be requested. Please try again.');
    }
  }

  async function captureAnswerSheet() {
    if (!canCapture || cameraRef.current == null) {
      return;
    }

    setIsCapturing(true);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.92,
        shutterSound: true,
      });

      if (!photo) {
        throw new Error('No photo was returned.');
      }

      const persistedUri = await persistAnswerSheetPhoto(photo.uri, 'image/jpeg');
      setSource('capture');
      setPhoto({ uri: persistedUri, mimeType: 'image/jpeg' });

      if (applicant || applicantDraft) {
        router.replace('/processing');
      } else {
        router.push('/identify-applicant');
      }
    } catch {
      setCameraError('The photo could not be captured. Please try again.');
    } finally {
      setIsCapturing(false);
    }
  }

  function renderCameraContent() {
    if (permission == null) {
      return (
        <View style={styles.cameraMessage}>
          <ActivityIndicator color={colors.gold} />
          <Text style={styles.cameraMessageText}>Checking camera access…</Text>
        </View>
      );
    }

    if (!permission.granted) {
      return (
        <View style={styles.cameraMessage}>
          <Ionicons name="camera-outline" color={colors.gold} size={34} />
          <Text style={styles.cameraMessageTitle}>Camera access needed</Text>
          <Text style={styles.cameraMessageText}>
            Allow camera access to photograph the answer sheet.
          </Text>
          <Pressable
            onPress={
              canRequestPermission
                ? () => void askForCameraPermission()
                : () => void Linking.openSettings()
            }
            accessibilityRole="button"
            accessibilityLabel={canRequestPermission ? 'Allow Camera' : 'Open Settings'}
            style={({ pressed }) => [
              styles.permissionButton,
              pressed && styles.permissionButtonPressed,
            ]}
          >
            <Text style={styles.permissionButtonText}>
              {canRequestPermission ? 'Allow Camera' : 'Open Settings'}
            </Text>
          </Pressable>
        </View>
      );
    }

    if (cameraError) {
      return (
        <View style={styles.cameraMessage}>
          <Ionicons name="warning-outline" color={colors.gold} size={34} />
          <Text style={styles.cameraMessageTitle}>Camera unavailable</Text>
          <Text style={styles.cameraMessageText}>{cameraError}</Text>
        </View>
      );
    }

    return (
      <>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          mode="picture"
          animateShutter={false}
          onCameraReady={() => setIsCameraReady(true)}
          onMountError={(error) => setCameraError(error.message)}
        />

        <View pointerEvents="none" style={styles.frameGuide}>
          <View style={[styles.guideCorner, styles.topLeftCorner]} />
          <View style={[styles.guideCorner, styles.topRightCorner]} />
          <View style={[styles.guideCorner, styles.bottomLeftCorner]} />
          <View style={[styles.guideCorner, styles.bottomRightCorner]} />

          <View style={styles.guideLabel}>
            <Text style={styles.guideLabelText}>Align OMR sheet within the frame</Text>
          </View>
        </View>
      </>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'right', 'bottom', 'left']}>
      <ScannerHeader action="back" onBack={() => router.back()} />

      <ScannerProgress step={1} />

      <ScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentWidth}>
          <Text style={styles.title}>Scan Answer Sheet</Text>
          <Text style={styles.subtitle}>
            Use bright, even lighting. Keep the entire sheet flat and inside the frame.
          </Text>

          <View style={styles.cameraViewport}>{renderCameraContent()}</View>

          <Pressable
            onPress={() => void captureAnswerSheet()}
            accessibilityRole="button"
            accessibilityLabel="Capture answer sheet"
            accessibilityHint="Captures the answer sheet and opens applicant identification"
            disabled={!canCapture}
            style={({ pressed }) => [
              styles.shutterButton,
              !canCapture && styles.shutterButtonDisabled,
              pressed && canCapture && styles.shutterButtonPressed,
            ]}
          >
            {isCapturing ? (
              <ActivityIndicator color={colors.gold} size="small" />
            ) : (
              <View style={styles.shutterCenter} />
            )}
          </Pressable>
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
    paddingTop: 17,
    paddingBottom: 28,
  },
  contentWidth: { width: '100%', maxWidth: 470 },
  title: { color: colors.navy, fontSize: 23, lineHeight: 30, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 2 },
  cameraViewport: {
    width: '100%',
    aspectRatio: 0.92,
    overflow: 'hidden',
    borderRadius: 13,
    backgroundColor: colors.navy,
    marginTop: 14,
  },
  cameraMessage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 34,
  },
  cameraMessageTitle: {
    color: colors.surface,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 10,
  },
  cameraMessageText: {
    color: '#D8DFEB',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 6,
  },
  permissionButton: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    backgroundColor: colors.gold,
    paddingHorizontal: 18,
    marginTop: 16,
  },
  permissionButtonPressed: { opacity: 0.84 },
  permissionButtonText: { color: colors.navy, fontSize: 13, fontWeight: '800' },
  frameGuide: {
    position: 'absolute',
    top: '4%',
    left: '14%',
    width: '72%',
    aspectRatio: 2404 / 3328,
    alignItems: 'center',
    justifyContent: 'flex-end',
    borderWidth: 2,
    borderColor: colors.gold,
    borderStyle: 'dashed',
  },
  guideCorner: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderColor: colors.gold,
  },
  topLeftCorner: { top: -2, left: -2, borderTopWidth: 3, borderLeftWidth: 3 },
  topRightCorner: { top: -2, right: -2, borderTopWidth: 3, borderRightWidth: 3 },
  bottomLeftCorner: { bottom: -2, left: -2, borderBottomWidth: 3, borderLeftWidth: 3 },
  bottomRightCorner: { right: -2, bottom: -2, borderRightWidth: 3, borderBottomWidth: 3 },
  guideLabel: {
    maxWidth: '90%',
    backgroundColor: 'rgba(16, 33, 63, 0.76)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: -8,
  },
  guideLabelText: { color: colors.surface, fontSize: 10, lineHeight: 14, textAlign: 'center' },
  shutterButton: {
    width: 62,
    height: 62,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.gold,
    borderRadius: 31,
    backgroundColor: colors.surface,
    marginTop: 18,
  },
  shutterButtonDisabled: { opacity: 0.42 },
  shutterButtonPressed: { transform: [{ scale: 0.95 }] },
  shutterCenter: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface },
});
