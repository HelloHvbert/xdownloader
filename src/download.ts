import { Directory, File, Paths } from 'expo-file-system';
import { Album, Asset, requestPermissionsAsync } from 'expo-media-library';
import type { SavedItem } from './history';
import type { TweetMedia } from './twitter';

const ALBUM = 'XDownloader';

function downloadsDir(): Directory {
  const dir = new Directory(Paths.document, 'downloads');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

async function addToGallery(uri: string): Promise<void> {
  const asset = await Asset.create(uri);
  try {
    const album = await Album.get(ALBUM);
    if (album) await album.add(asset);
    else await Album.create(ALBUM, [asset]);
  } catch {
    // The file is already in the gallery; the album is just a nicety.
  }
}

/**
 * Downloads every media file of a tweet into the app's documents folder
 * (so history can share it later) and copies it to the device gallery.
 */
export async function downloadTweet(
  tweet: TweetMedia,
  onProgress: (done: number, total: number) => void,
): Promise<{ items: SavedItem[]; savedToGallery: boolean }> {
  const permission = await requestPermissionsAsync(true);
  const canSave = permission.granted;

  const dir = downloadsDir();
  const items: SavedItem[] = [];
  const total = tweet.media.length;
  onProgress(0, total);

  for (let i = 0; i < total; i++) {
    const m = tweet.media[i];
    const name = `${tweet.author}_${tweet.tweetId}_${i + 1}.${m.extension}`;
    const file = await File.downloadFileAsync(m.url, new File(dir, name), { idempotent: true });
    if (canSave) await addToGallery(file.uri);
    items.push({ type: m.type, localUri: file.uri, thumbnail: m.type === 'photo' ? file.uri : m.thumbnail });
    onProgress(i + 1, total);
  }
  return { items, savedToGallery: canSave };
}

export function deleteLocalFiles(items: SavedItem[]): void {
  for (const item of items) {
    try {
      const file = new File(item.localUri);
      if (file.exists) file.delete();
    } catch {
      // ignore
    }
  }
}

export function fileExists(uri: string): boolean {
  try {
    return new File(uri).exists;
  } catch {
    return false;
  }
}
