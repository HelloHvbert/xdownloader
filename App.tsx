import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import * as Sharing from 'expo-sharing';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { deleteLocalFiles, downloadTweet } from './src/download';
import { HistoryEntry, loadHistory, SavedItem, saveHistory } from './src/history';
import { fetchTweetMedia, parseTweetId } from './src/twitter';
import { Viewer } from './src/Viewer';

const C = {
  bg: '#0b0d10',
  card: '#16191e',
  border: '#262a31',
  text: '#e7e9ea',
  muted: '#8b949e',
  accent: '#1d9bf0',
  danger: '#f4212e',
  ok: '#00ba7c',
};

type Status = { kind: 'idle' } | { kind: 'busy'; label: string } | { kind: 'ok' | 'error'; label: string };

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Main />
    </SafeAreaProvider>
  );
}

function Main() {
  const [link, setLink] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const busyRef = useRef(false);
  const [viewing, setViewing] = useState<HistoryEntry | null>(null);

  useEffect(() => {
    loadHistory().then(setHistory);
  }, []);

  const updateHistory = useCallback((fn: (prev: HistoryEntry[]) => HistoryEntry[]) => {
    setHistory((prev) => {
      const next = fn(prev);
      saveHistory(next).catch(() => {});
      return next;
    });
  }, []);

  const paste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) setLink(text.trim());
  };

  const download = async (input: string = link) => {
    if (busyRef.current) return;
    const id = parseTweetId(input);
    if (!id) {
      setStatus({ kind: 'error', label: 'To nie wygląda na link do posta z X/Twittera.' });
      return;
    }
    busyRef.current = true;
    try {
      setStatus({ kind: 'busy', label: 'Szukam mediów…' });
      const tweet = await fetchTweetMedia(id);
      const { items, savedToGallery } = await downloadTweet(tweet, (done, total) =>
        setStatus({ kind: 'busy', label: `Pobieranie ${done}/${total}…` }),
      );
      const entry: HistoryEntry = {
        id: `${tweet.tweetId}-${Date.now()}`,
        tweetId: tweet.tweetId,
        author: tweet.author,
        authorName: tweet.authorName,
        text: tweet.text,
        createdAt: Date.now(),
        items,
      };
      updateHistory((prev) => [entry, ...prev.filter((e) => e.tweetId !== tweet.tweetId)]);
      setLink('');
      setStatus({
        kind: 'ok',
        label: savedToGallery
          ? `Zapisano ${items.length} ${plural(items.length)} w galerii (album XDownloader).`
          : `Pobrano ${items.length} ${plural(items.length)}. Brak zgody na galerię — pliki są w historii.`,
      });
    } catch (e) {
      setStatus({ kind: 'error', label: e instanceof Error ? e.message : 'Coś poszło nie tak.' });
    } finally {
      busyRef.current = false;
    }
  };

  // Links shared to the app from X (or any other app) via the system share sheet.
  const downloadRef = useRef(download);
  downloadRef.current = download;
  useEffect(() => {
    const handleShare = () => {
      const text = readIncomingShare();
      if (!text) return;
      setLink(text);
      if (parseTweetId(text)) downloadRef.current(text);
      else setStatus({ kind: 'error', label: 'Udostępniona treść nie zawiera linku do posta.' });
    };
    handleShare();
    const appState = AppState.addEventListener('change', (s) => s === 'active' && handleShare());
    const url = Linking.addEventListener('url', handleShare);
    return () => {
      appState.remove();
      url.remove();
    };
  }, []);

  const share = async (item: SavedItem) => {
    if (!(await Sharing.isAvailableAsync())) return;
    await Sharing.shareAsync(item.localUri, {
      mimeType: item.type === 'photo' ? 'image/jpeg' : 'video/mp4',
    });
  };

  const redownload = (entry: HistoryEntry) => {
    setViewing(null);
    download(tweetUrl(entry));
  };

  const remove = (entry: HistoryEntry) => {
    Alert.alert('Usunąć z historii?', 'Plik w galerii zostanie zachowany.', [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Usuń',
        style: 'destructive',
        onPress: () => {
          deleteLocalFiles(entry.items);
          updateHistory((prev) => prev.filter((e) => e.id !== entry.id));
          setViewing(null);
        },
      },
    ]);
  };

  const clearAll = () => {
    Alert.alert('Wyczyścić historię?', 'Pliki w galerii zostaną zachowane.', [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Wyczyść',
        style: 'destructive',
        onPress: () => {
          history.forEach((e) => deleteLocalFiles(e.items));
          updateHistory(() => []);
        },
      },
    ]);
  };

  const busy = status.kind === 'busy';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          data={history}
          keyExtractor={(e) => e.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View>
              <Text style={styles.title}>XDownloader</Text>
              <Text style={styles.subtitle}>Wklej link do posta, a zdjęcia i filmy trafią do galerii.</Text>

              <View style={styles.inputRow}>
                <TextInput
                  value={link}
                  onChangeText={setLink}
                  placeholder="https://x.com/user/status/…"
                  placeholderTextColor={C.muted}
                  style={styles.input}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  returnKeyType="go"
                  onSubmitEditing={() => download()}
                  editable={!busy}
                />
                <Pressable onPress={link ? () => setLink('') : paste} style={styles.pasteBtn} disabled={busy}>
                  <Text style={styles.pasteText}>{link ? 'Wyczyść' : 'Wklej'}</Text>
                </Pressable>
              </View>

              <Pressable
                onPress={() => download()}
                disabled={busy || !link.trim()}
                style={({ pressed }) => [
                  styles.button,
                  (busy || !link.trim()) && { opacity: 0.5 },
                  pressed && { opacity: 0.8 },
                ]}
              >
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Pobierz</Text>}
              </Pressable>

              {status.kind !== 'idle' && (
                <Text
                  style={[
                    styles.status,
                    status.kind === 'error' && { color: C.danger },
                    status.kind === 'ok' && { color: C.ok },
                  ]}
                >
                  {status.label}
                </Text>
              )}

              <View style={styles.historyHeader}>
                <Text style={styles.sectionTitle}>Historia</Text>
                {history.length > 0 && (
                  <Pressable onPress={clearAll} hitSlop={8}>
                    <Text style={{ color: C.danger }}>Wyczyść</Text>
                  </Pressable>
                )}
              </View>
            </View>
          }
          ListEmptyComponent={<Text style={styles.empty}>Tu pojawią się pobrane posty.</Text>}
          renderItem={({ item }) => (
            <HistoryRow
              entry={item}
              onPress={() => setViewing(item)}
              onOpen={() => Linking.openURL(tweetUrl(item))}
              onDelete={() => remove(item)}
            />
          )}
        />
      </KeyboardAvoidingView>
      <Viewer
        key={viewing?.id}
        entry={viewing}
        onClose={() => setViewing(null)}
        onShare={share}
        onOpenPost={(e) => Linking.openURL(tweetUrl(e))}
        onDelete={remove}
        onRedownload={redownload}
      />
    </SafeAreaView>
  );
}

function HistoryRow({
  entry,
  onPress,
  onOpen,
  onDelete,
}: {
  entry: HistoryEntry;
  onPress: () => void;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const first = entry.items[0];
  const hasVideo = entry.items.some((i) => i.type !== 'photo');
  return (
    <Pressable onPress={onPress} onLongPress={onDelete} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
      <View>
        <Image source={first?.thumbnail || undefined} style={styles.thumb} contentFit="cover" />
        {hasVideo && <Text style={styles.badge}>▶</Text>}
        {entry.items.length > 1 && <Text style={[styles.badge, styles.count]}>{entry.items.length}</Text>}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.author} numberOfLines={1}>
          {entry.authorName || entry.author} <Text style={{ color: C.muted }}>@{entry.author}</Text>
        </Text>
        <Text style={styles.text} numberOfLines={2}>
          {entry.text.replace(/\s*https:\/\/t\.co\/\w+$/, '') || '—'}
        </Text>
        <View style={styles.meta}>
          <Text style={styles.date}>{new Date(entry.createdAt).toLocaleString()}</Text>
          <Pressable onPress={onOpen} hitSlop={8}>
            <Text style={{ color: C.accent, fontSize: 12 }}>Otwórz post</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

/** Returns text/URL shared into the app (and consumes it), or null. */
function readIncomingShare(): string | null {
  try {
    const payloads = Sharing.getSharedPayloads();
    if (!payloads.length) return null;
    Sharing.clearSharedPayloads();
    const text = payloads
      .filter((p) => p.shareType === 'text' || p.shareType === 'url')
      .map((p) => p.value)
      .join(' ')
      .trim();
    return text || null;
  } catch {
    // Not supported (e.g. Expo Go / web).
    return null;
  }
}

function tweetUrl(e: HistoryEntry) {
  return `https://x.com/${e.author}/status/${e.tweetId}`;
}

function plural(n: number) {
  if (n === 1) return 'plik';
  const mod10 = n % 10;
  const mod100 = n % 100;
  return mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? 'pliki' : 'plików';
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  list: { padding: 16, paddingBottom: 48 },
  title: { color: C.text, fontSize: 28, fontWeight: '800', marginTop: 8 },
  subtitle: { color: C.muted, marginTop: 4, marginBottom: 20 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 12,
  },
  input: { flex: 1, color: C.text, paddingHorizontal: 14, paddingVertical: 14, fontSize: 15 },
  pasteBtn: { paddingHorizontal: 14, paddingVertical: 10 },
  pasteText: { color: C.accent, fontWeight: '600' },
  button: {
    marginTop: 12,
    backgroundColor: C.accent,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  status: { color: C.muted, marginTop: 12, textAlign: 'center' },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 8,
  },
  sectionTitle: { color: C.text, fontSize: 18, fontWeight: '700' },
  empty: { color: C.muted, textAlign: 'center', marginTop: 24 },
  row: {
    flexDirection: 'row',
    gap: 12,
    padding: 10,
    backgroundColor: C.card,
    borderRadius: 12,
    marginBottom: 8,
  },
  thumb: { width: 64, height: 64, borderRadius: 8, backgroundColor: C.border },
  badge: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    color: '#fff',
    fontSize: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 5,
    borderRadius: 4,
    overflow: 'hidden',
  },
  count: { left: undefined, right: 4 },
  author: { color: C.text, fontWeight: '600' },
  text: { color: C.text, opacity: 0.85, marginTop: 2, fontSize: 13 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  date: { color: C.muted, fontSize: 12 },
});
