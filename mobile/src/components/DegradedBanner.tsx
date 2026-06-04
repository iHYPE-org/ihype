import { StyleSheet, Text, View } from 'react-native';

export function DegradedBanner() {
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>Having trouble connecting — some data may be outdated</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#f59e0b',
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  text: {
    color: '#000',
    fontSize: 12,
    fontWeight: '600',
  },
});
