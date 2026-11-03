import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MediaType } from './twitter';

export type SavedItem = {
  type: MediaType;
  localUri: string;
  thumbnail: string;
};

export type HistoryEntry = {
  id: string;
  tweetId: string;
  author: string;
  authorName: string;
  text: string;
  createdAt: number;
  items: SavedItem[];
};

const KEY = 'xdownloader:history:v1';
const LIMIT = 200;

export async function loadHistory(): Promise<HistoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export async function saveHistory(entries: HistoryEntry[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(entries.slice(0, LIMIT)));
}
