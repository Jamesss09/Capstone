import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

type ScannerProgressProps = {
  step: 1 | 2 | 3 | 4;
};

const STEP_LABELS = ['CAPTURE', 'IDENTIFY', 'PROCESSING', 'RESULT'] as const;

export function ScannerProgress({ step }: ScannerProgressProps) {
  return (
    <View style={styles.container}>
      <View style={styles.labels}>
        <Text style={styles.stepLabel}>{STEP_LABELS[step - 1]}</Text>
        <Text style={styles.stepCount}>Step {step} of 4</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${step * 25}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingTop: 12 },
  labels: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 7,
  },
  stepLabel: {
    color: colors.navy,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  stepCount: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  track: {
    height: 4,
    overflow: 'hidden',
    borderRadius: 2,
    backgroundColor: colors.goldSoft,
  },
  fill: { height: '100%', borderRadius: 2, backgroundColor: colors.gold },
});
