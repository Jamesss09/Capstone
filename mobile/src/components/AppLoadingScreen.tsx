import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';

export function AppLoadingScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Image
          source={require('../../assets/tmc-seal.png')}
          resizeMode="contain"
          style={styles.logo}
        />
        <ActivityIndicator color={colors.gold} size="small" />
        <Text style={styles.text}>Restoring secure session…</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  logo: {
    width: 88,
    height: 88,
  },
  text: {
    color: colors.muted,
    fontSize: 13,
  },
});
