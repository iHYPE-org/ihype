import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWorkbenchData } from '@/hooks/useWorkbenchData';

export default function TicketsScreen() {
  const result = useWorkbenchData();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading}>MY TICKETS</Text>

        {result.status === 'loading' && <ActivityIndicator color="#ff5029" />}

        {result.status === 'error' && (
          <View style={styles.center}>
            <Text style={styles.errorText}>Couldn't load tickets</Text>
            <Pressable style={styles.retryBtn} onPress={result.refresh}>
              <Text style={styles.retryText}>TRY AGAIN</Text>
            </Pressable>
          </View>
        )}

        {result.status === 'ok' && result.data.tickets.map((t) => (
          <View key={t.id} style={styles.ticket}>
            <View style={styles.ticketLeft}>
              <Text style={styles.ticketShow} numberOfLines={2}>{t.showName}</Text>
              <Text style={styles.ticketDate}>{t.date}</Text>
              <View style={[styles.statusPill, t.status === 'CONFIRMED' && styles.statusConfirmed]}>
                <Text style={styles.statusText}>{t.status}</Text>
              </View>
            </View>
            <View style={styles.ticketRight}>
              <Text style={styles.qrLabel}>TAP TO SHOW</Text>
              <View style={styles.qrBox}>
                <Text style={styles.qrCode}>{t.code.slice(-6)}</Text>
              </View>
            </View>
          </View>
        ))}

        {result.status === 'ok' && result.data.tickets.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No tickets yet</Text>
            <Text style={styles.emptySub}>Browse upcoming shows to grab yours.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  scroll: { padding: 20, paddingBottom: 40 },
  center: { alignItems: 'center', marginTop: 60 },
  heading: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: 3, marginBottom: 20 },
  ticket: {
    flexDirection: 'row', backgroundColor: '#141414', borderRadius: 12,
    overflow: 'hidden', marginBottom: 14, borderWidth: 1, borderColor: '#2a2a2a',
  },
  ticketLeft: { flex: 1, padding: 16 },
  ticketShow: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  ticketDate: { color: '#666', fontSize: 12, marginBottom: 10 },
  statusPill: { alignSelf: 'flex-start', backgroundColor: '#1e1e1e', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  statusConfirmed: { backgroundColor: 'rgba(34,229,212,0.15)' },
  statusText: { color: '#22e5d4', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  ticketRight: {
    width: 80, backgroundColor: '#0f0f0f', alignItems: 'center',
    justifyContent: 'center', padding: 10, borderLeftWidth: 1, borderLeftColor: '#2a2a2a',
  },
  qrLabel: { color: '#444', fontSize: 8, letterSpacing: 1, marginBottom: 6 },
  qrBox: {
    width: 52, height: 52, backgroundColor: '#1a1a1a',
    borderRadius: 6, alignItems: 'center', justifyContent: 'center',
  },
  qrCode: { color: '#ff5029', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySub: { color: '#555', fontSize: 13 },
  errorText: { color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 16 },
  retryBtn: { backgroundColor: '#1e1e1e', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 24 },
  retryText: { color: '#ff5029', fontSize: 13, fontWeight: '700', letterSpacing: 2 },
});
