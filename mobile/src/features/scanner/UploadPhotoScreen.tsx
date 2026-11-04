import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScannerHeader } from '@/features/scanner/ScannerHeader';
import { ScannerProgress } from '@/features/scanner/ScannerProgress';
import { useScannerWorkflow } from '@/features/scanner/ScannerWorkflowContext';
import { persistAnswerSheetPhoto } from '@/features/scanner/answerSheetPhoto';
import { colors } from '@/theme/colors';

export function UploadPhotoScreen() {
  const router = useRouter();
  const { applicant, applicantDraft, setPhoto, setSource } = useScannerWorkflow();
  const [isPicking, setIsPicking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function pickPhoto() {
    setErrorMessage(null);
    setIsPicking(true);

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        if (!permission.canAskAgain) {
          Alert.alert(
            'Photo access is disabled',
            'Enable photo access in Settings to choose an answer sheet image.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => void Linking.openSettings() },
            ],
          );
        } else {
          Alert.alert('Permission required', 'Photo access is needed to choose an answer sheet.');
        }
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.92,
        selectionLimit: 1,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const mimeType = asset.mimeType ?? 'image/jpeg';
        const persistedUri = await persistAnswerSheetPhoto(asset.uri, mimeType);
        setSource('upload');
        setPhoto({
          uri: persistedUri,
          mimeType,
          ...(asset.fileName ? { fileName: asset.fileName } : {}),
        });

        if (applicant || applicantDraft) {
          router.replace('/processing');
        } else {
          router.push('/identify-applicant');
        }
      }
    } catch {
      setErrorMessage('The photo library could not be opened. Please try again.');
    } finally {
      setIsPicking(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'right', 'bottom', 'left']}>
      <ScannerHeader action="back" onBack={() => router.back()} />
      <ScannerProgress step={1} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.contentWidth}>
          <Text style={styles.title}>Upload Answer Sheet</Text>
          <Text style={styles.subtitle}>
            Select a photo, then identify the applicant before uploading.
          </Text>

          <View style={styles.photoPlaceholder}>
            <Ionicons name="image-outline" color={colors.gold} size={38} />
            <Text style={styles.previewTitle}>No photo selected</Text>
            <Text style={styles.previewText}>Select the answer sheet from your phone.</Text>
          </View>

          <Pressable
            onPress={() => void pickPhoto()}
            disabled={isPicking}
            accessibilityRole="button"
            accessibilityLabel="Choose answer sheet photo"
            style={({ pressed }) => [
              styles.chooseButton,
              isPicking && styles.disabledButton,
              pressed && styles.chooseButtonPressed,
            ]}
          >
            <Ionicons name="images-outline" color={colors.navy} size={19} />
            <Text style={styles.chooseButtonText}>
              {isPicking ? 'Opening Photos…' : 'Choose Photo'}
            </Text>
          </Pressable>

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
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
  photoPlaceholder: {
    width: '100%',
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 13,
    backgroundColor: colors.navy,
    marginTop: 18,
  },
  previewTitle: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 10,
  },
  previewText: { color: '#D8DFEB', fontSize: 12, marginTop: 5 },
  chooseButton: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    marginTop: 13,
  },
  chooseButtonPressed: { backgroundColor: colors.input },
  chooseButtonText: { color: colors.navy, fontSize: 13, fontWeight: '800' },
  errorText: { color: colors.danger, fontSize: 12, lineHeight: 18, marginTop: 8 },
  disabledButton: { opacity: 0.55 },
});
