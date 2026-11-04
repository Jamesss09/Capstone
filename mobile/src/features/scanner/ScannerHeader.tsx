import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthContext';
import { colors } from '@/theme/colors';

type ScannerHeaderProps = {
  action?: 'sign-out' | 'back';
  onBack?: () => void;
};

export function ScannerHeader({ action = 'sign-out', onBack }: ScannerHeaderProps) {
  const { signOut } = useAuth();
  const [isSignOutModalVisible, setIsSignOutModalVisible] = useState(false);

  function confirmSignOut() {
    setIsSignOutModalVisible(false);
    void signOut();
  }

  return (
    <>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>EXAMINATION STAFF</Text>
          <Text style={styles.appName}>TMC Scanner</Text>
        </View>

        {action === 'sign-out' ? (
          <Pressable
            onPress={() => setIsSignOutModalVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Sign Out"
            hitSlop={10}
            style={({ pressed }) => [
              styles.headerActionButton,
              pressed && styles.headerActionButtonPressed,
            ]}
          >
            <Ionicons name="log-out-outline" color={colors.navy} size={18} />
            <Text style={styles.headerActionText}>Sign Out</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back to Scanner Home"
            hitSlop={10}
            style={({ pressed }) => [
              styles.headerActionButton,
              pressed && styles.headerActionButtonPressed,
            ]}
          >
            <Ionicons name="arrow-back" color={colors.navy} size={18} />
            <Text style={styles.headerActionText}>Back</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.divider} />

      {action === 'sign-out' ? (
        <Modal
          animationType="fade"
          transparent
          visible={isSignOutModalVisible}
          onRequestClose={() => setIsSignOutModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View
              accessibilityViewIsModal
              accessibilityLabel="Sign out confirmation"
              style={styles.modalCard}
            >
              <View style={styles.modalIcon}>
                <Ionicons name="log-out-outline" color={colors.danger} size={24} />
              </View>

              <Text style={styles.modalTitle}>Sign out?</Text>
              <Text style={styles.modalMessage}>
                Are you sure you want to sign out of your staff account?
              </Text>

              <View style={styles.modalActions}>
                <Pressable
                  onPress={() => setIsSignOutModalVisible(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel sign out"
                  style={({ pressed }) => [
                    styles.modalCancelButton,
                    pressed && styles.modalCancelButtonPressed,
                  ]}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </Pressable>

                <Pressable
                  onPress={confirmSignOut}
                  accessibilityRole="button"
                  accessibilityLabel="Confirm Sign Out"
                  style={({ pressed }) => [
                    styles.modalConfirmButton,
                    pressed && styles.modalConfirmButtonPressed,
                  ]}
                >
                  <Text style={styles.modalConfirmText}>Sign Out</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
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
  headerActionButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  headerActionButtonPressed: {
    backgroundColor: colors.input,
  },
  headerActionText: {
    color: colors.navy,
    fontSize: 13,
    fontWeight: '700',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  modalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 33, 63, 0.48)',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: colors.surface,
    padding: 24,
    elevation: 8,
  },
  modalIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: colors.dangerBackground,
  },
  modalTitle: {
    color: colors.navy,
    fontSize: 21,
    lineHeight: 28,
    fontWeight: '800',
    marginTop: 14,
  },
  modalMessage: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 6,
  },
  modalActions: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
  },
  modalCancelButton: {
    minHeight: 46,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
  },
  modalCancelButtonPressed: {
    backgroundColor: colors.input,
  },
  modalCancelText: {
    color: colors.navy,
    fontSize: 14,
    fontWeight: '700',
  },
  modalConfirmButton: {
    minHeight: 46,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: colors.danger,
    paddingHorizontal: 12,
  },
  modalConfirmButtonPressed: {
    opacity: 0.84,
  },
  modalConfirmText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '800',
  },
});
