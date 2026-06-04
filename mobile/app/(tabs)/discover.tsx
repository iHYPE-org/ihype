import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWorkbenchData } from '@/hooks/useWorkbenchData';

export default function DiscoverScreen() {
  const state = useWorkbenchData();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading}>DISCOVER</Text>

        {state.status === 'loading' && <ActivityIndicator color="#ff5029" />}

        {state.status === 'ok' && (state.data as { trending?: { id: string; name: string; city: string; genre: string; hypeCount: number }[] }).trending?.map((p) => (
          <Pressable key={p.id} style={styles.card}>
            <View style={styles.cardInner}>
              <Text style={styles.cardName}>{p.name}</Text>
              <Text style={styles.cardMeta}>{p.city} · {p.genre}</Text>
            </View>
            <View style={styles.hypePill}>
              <Text style={styles.hypeNum}>{p.hypeCount}</Text>
              <Text style={styles.hypeLabel}>HYPE</Text>
            </View>
          </Pressable>
        ))}

        {state.status === 'ok' && !(state.data as { trending?: unknown[] }).trending?.length && (
          <Text style={styles.empty}>No trending artists right now. Check back soon.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  scroll: { padding: 20, paddingBottom: 40 },
  heading: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: 3, marginBottom: 20 },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#141414',
    borderRadius: 10, padding: 14, marginBottom: 10,
  },
  cardInner: { flex: 1 },
  cardName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  cardMeta: { color: '#555', fontSize: 12, marginTop: 2 },
  hypePill: { alignItems: 'center', backgroundColor: '#1e1e1e', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  hypeNum: { color: '#ff5029', fontSize: 16, fontWeight: '800' },
  hypeLabel: { color: '#555', fontSize: 8, letterSpacing: 1 },
  empty: { color: '#444', fontSize: 14, textAlign: 'center', marginTop: 40 },
});
