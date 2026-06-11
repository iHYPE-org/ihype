import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DegradedBanner } from '@/components/DegradedBanner';
import { useWorkbenchData } from '@/hooks/useWorkbenchData';

export default function HomeScreen() {
  const result = useWorkbenchData();

  if (result.status === 'loading') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator color="#ff5029" size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (result.status === 'error') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.errorText}>Couldn't load data</Text>
          <Pressable style={styles.retryBtn} onPress={result.refresh}>
            <Text style={styles.retryText}>TRY AGAIN</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const { data, refresh, refreshing } = result;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {data.degraded && <DegradedBanner />}
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#ff5029" />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.name}>{data.userName.split(' ')[0].toUpperCase()}</Text>
            {!!data.city && <Text style={styles.city}>{data.city}</Text>}
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{data.userInitials}</Text>
          </View>
        </View>

        {/* Live stats */}
        <View style={styles.statsRow}>
          <StatChip label="HYPED TODAY" value={String(data.hypedToday)} color="#ff3e9a" />
          <StatChip label="LISTENING NOW" value={String(data.listeningNow)} color="#22e5d4" />
          <StatChip label="SHOWS TONIGHT" value={String(data.showsTonight)} color="#ffb84a" />
        </View>

        {/* Upcoming shows */}
        {data.shows.length > 0 && (
          <Section title="UPCOMING SHOWS">
            {data.shows.slice(0, 4).map((s) => (
              <View key={s.id} style={styles.showRow}>
                <View style={styles.showInfo}>
                  <Text style={styles.showName} numberOfLines={1}>{s.name}</Text>
                  <Text style={styles.showVenue}>{s.venue} · {s.date}</Text>
                </View>
                <View style={[styles.showBadge, { backgroundColor: statusColor(s.status) }]}>
                  <Text style={styles.showBadgeText}>{s.status}</Text>
                </View>
              </View>
            ))}
          </Section>
        )}

        {/* Tracks */}
        {data.tracks.length > 0 && (
          <Section title="YOUR TRACKS">
            <FlatList
              horizontal
              data={data.tracks.slice(0, 8)}
              keyExtractor={(t) => t.id}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item: t }) => (
                <Pressable style={[styles.trackCard, { borderLeftColor: t.color }]}>
                  <Text style={styles.trackTitle} numberOfLines={2}>{t.title}</Text>
                  <Text style={styles.trackArtist} numberOfLines={1}>{t.artistName}</Text>
                </Pressable>
              )}
            />
          </Section>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.statChip}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function statusColor(status: string): string {
  switch (status) {
    case 'TONIGHT': return '#ff5029';
    case 'NEAR SOLD': return '#ff3e9a';
    case 'THIS WEEK': return '#b983ff';
    default: return '#2a2a2a';
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  greeting: { color: '#666', fontSize: 12, letterSpacing: 1 },
  name: { color: '#fff', fontSize: 28, fontWeight: '900', letterSpacing: 2 },
  city: { color: '#555', fontSize: 11, marginTop: 2 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#ff5029', alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  statChip: {
    flex: 1, backgroundColor: '#141414', borderRadius: 10,
    padding: 12, alignItems: 'center',
  },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { color: '#555', fontSize: 9, letterSpacing: 1, marginTop: 2 },
  section: { marginBottom: 28 },
  sectionTitle: { color: '#444', fontSize: 11, fontWeight: '700', letterSpacing: 2, marginBottom: 12 },
  showRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#141414', borderRadius: 8, padding: 12, marginBottom: 8,
  },
  showInfo: { flex: 1, marginRight: 10 },
  showName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  showVenue: { color: '#555', fontSize: 12, marginTop: 2 },
  showBadge: { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  showBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  trackCard: {
    backgroundColor: '#141414', borderRadius: 8, padding: 14,
    width: 140, marginRight: 10, borderLeftWidth: 3,
  },
  trackTitle: { color: '#fff', fontSize: 13, fontWeight: '600', marginBottom: 4 },
  trackArtist: { color: '#555', fontSize: 11 },
  errorText: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 16 },
  retryBtn: {
    backgroundColor: '#1e1e1e', borderRadius: 8,
    paddingVertical: 12, paddingHorizontal: 24,
  },
  retryText: { color: '#ff5029', fontSize: 13, fontWeight: '700', letterSpacing: 2 },
});
