import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fileExists } from './download';
import type { HistoryEntry, SavedItem } from './history';

type Props = {
  entry: HistoryEntry | null;
  onClose: () => void;
  onShare: (item: SavedItem) => void;
  onOpenPost: (entry: HistoryEntry) => void;
  onDelete: (entry: HistoryEntry) => void;
  onRedownload: (entry: HistoryEntry) => void;
};

/** Full-screen preview of the media of one history entry. */
export function Viewer({ entry, onClose, onShare, onOpenPost, onDelete, onRedownload }: Props) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);

  if (!entry) return null;
  const items = entry.items;
  const current = items[Math.min(index, items.length - 1)];
  const currentExists = current ? fileExists(current.localUri) : false;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <SafeAreaView style={styles.root}>
        <View style={styles.top}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.close}>✕</Text>
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>
            @{entry.author}
          </Text>
          <Text style={styles.counter}>{items.length > 1 ? `${index + 1}/${items.length}` : ''}</Text>
        </View>

        <FlatList
          data={items}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item, i) => `${item.localUri}-${i}`}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item, index: i }) => (
            <View style={{ width, flex: 1 }}>
              <MediaPage item={item} active={i === index} onRedownload={() => onRedownload(entry)} />
            </View>
          )}
        />

        {!!entry.text && (
          <Text style={styles.text} numberOfLines={3}>
            {entry.text.replace(/\s*https:\/\/t\.co\/\w+$/, '')}
          </Text>
        )}

        <View style={styles.actions}>
          <Action label="Udostępnij" disabled={!currentExists} onPress={() => current && onShare(current)} />
          <Action label="Otwórz post" onPress={() => onOpenPost(entry)} />
          <Action label="Usuń" danger onPress={() => onDelete(entry)} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function MediaPage({ item, active, onRedownload }: { item: SavedItem; active: boolean; onRedownload: () => void }) {
  if (!fileExists(item.localUri)) {
    return (
      <View style={styles.center}>
        <Text style={styles.missing}>Plik został usunięty z pamięci aplikacji.</Text>
        <Pressable onPress={onRedownload} style={styles.redownload}>
          <Text style={styles.redownloadText}>Pobierz ponownie</Text>
        </Pressable>
      </View>
    );
  }
  if (item.type === 'photo') {
    return <Image source={item.localUri} style={styles.media} contentFit="contain" />;
  }
  return <VideoPage uri={item.localUri} gif={item.type === 'gif'} active={active} />;
}

function VideoPage({ uri, gif, active }: { uri: string; gif: boolean; active: boolean }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = gif;
    p.muted = gif;
  });

  useEffect(() => {
    if (active) player.play();
    else player.pause();
  }, [active, player]);

  return <VideoView player={player} style={styles.media} contentFit="contain" nativeControls={!gif} />;
}

function Action({
  label,
  onPress,
  danger,
  disabled,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.action, (pressed || disabled) && { opacity: 0.5 }]}
    >
      <Text style={[styles.actionText, danger && { color: '#f4212e' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 12 },
  close: { color: '#fff', fontSize: 22 },
  title: { flex: 1, color: '#e7e9ea', fontWeight: '600', fontSize: 16 },
  counter: { color: '#8b949e', minWidth: 40, textAlign: 'right' },
  media: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  missing: { color: '#8b949e', textAlign: 'center' },
  redownload: { marginTop: 16, backgroundColor: '#1d9bf0', borderRadius: 999, paddingHorizontal: 20, paddingVertical: 10 },
  redownloadText: { color: '#fff', fontWeight: '700' },
  text: { color: '#e7e9ea', opacity: 0.85, paddingHorizontal: 16, paddingTop: 12, fontSize: 13 },
  actions: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 14 },
  action: { paddingHorizontal: 16, paddingVertical: 8 },
  actionText: { color: '#1d9bf0', fontWeight: '600', fontSize: 15 },
});
