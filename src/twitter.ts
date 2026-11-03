// Resolving tweet media without the official API.
// Primary source: Twitter's public embed ("syndication") endpoint.
// Fallback: the public fxtwitter API.

export type MediaType = 'photo' | 'video' | 'gif';

export type MediaItem = {
  type: MediaType;
  /** Direct URL of the best-quality file. */
  url: string;
  /** Preview image URL (for videos: poster frame). */
  thumbnail: string;
  extension: 'jpg' | 'png' | 'mp4';
};

export type TweetMedia = {
  tweetId: string;
  author: string; // screen name, without "@"
  authorName: string;
  text: string;
  media: MediaItem[];
};

const HOSTS = /^(?:www\.|mobile\.|m\.)?(?:twitter\.com|x\.com|fxtwitter\.com|vxtwitter\.com|fixupx\.com|fixvx\.com|nitter\.net)$/i;

/** Extracts the tweet id from a link (or accepts a bare numeric id). */
export function parseTweetId(input: string): string | null {
  const trimmed = input.trim();
  if (/^\d{5,25}$/.test(trimmed)) return trimmed;

  const match = trimmed.match(/https?:\/\/[^\s]+/i);
  const candidate = match ? match[0] : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (!HOSTS.test(url.hostname)) return null;
  const id = url.pathname.match(/\/(?:status|statuses)\/(\d{5,25})/);
  return id ? id[1] : null;
}

/** Token required by the syndication endpoint (same formula as the official embed widget). */
export function syndicationToken(id: string): string {
  return ((Number(id) / 1e15) * Math.PI).toString(6 ** 2).replace(/(0+|\.)/g, '');
}

function photoOriginal(url: string): { url: string; extension: 'jpg' | 'png' } {
  const m = url.match(/^(https:\/\/pbs\.twimg\.com\/media\/[^.?]+)\.(jpg|jpeg|png|webp)/i);
  if (!m) return { url, extension: 'jpg' };
  const extension = m[2].toLowerCase() === 'png' ? 'png' : 'jpg';
  return { url: `${m[1]}?format=${extension}&name=orig`, extension };
}

type Variant = { bitrate?: number; content_type?: string; url: string };

export function bestMp4(variants: Variant[] | undefined): string | null {
  const mp4 = (variants ?? []).filter((v) => v.content_type === 'video/mp4' || /\.mp4(\?|$)/.test(v.url));
  if (!mp4.length) return null;
  mp4.sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));
  return mp4[0].url;
}

/** Parses the JSON returned by cdn.syndication.twimg.com/tweet-result. */
export function parseSyndication(id: string, json: any): TweetMedia {
  if (!json || json.__typename === 'TweetTombstone') {
    throw new Error('Tweet jest niedostępny (usunięty, prywatny lub z ograniczeniem wieku).');
  }
  // Quote tweets without own media: take media from the quoted tweet.
  const source = json.mediaDetails?.length ? json : json.quoted_tweet?.mediaDetails?.length ? json.quoted_tweet : json;
  const media: MediaItem[] = [];
  for (const m of source.mediaDetails ?? []) {
    if (m.type === 'photo') {
      const p = photoOriginal(m.media_url_https);
      media.push({ type: 'photo', url: p.url, extension: p.extension, thumbnail: m.media_url_https });
    } else if (m.type === 'video' || m.type === 'animated_gif') {
      const url = bestMp4(m.video_info?.variants);
      if (url) {
        media.push({ type: m.type === 'video' ? 'video' : 'gif', url, extension: 'mp4', thumbnail: m.media_url_https });
      }
    }
  }
  return {
    tweetId: json.id_str ?? id,
    author: json.user?.screen_name ?? 'unknown',
    authorName: json.user?.name ?? '',
    text: json.text ?? '',
    media,
  };
}

/** Parses the JSON returned by api.fxtwitter.com/status/:id. */
export function parseFxTwitter(id: string, json: any): TweetMedia {
  const tweet = json?.tweet;
  if (!tweet) throw new Error(json?.message || 'Nie znaleziono tweeta.');
  const media: MediaItem[] = [];
  for (const m of tweet.media?.all ?? []) {
    if (m.type === 'photo') {
      const p = photoOriginal(m.url);
      media.push({ type: 'photo', url: p.url, extension: p.extension, thumbnail: m.url });
    } else if (m.type === 'video' || m.type === 'gif') {
      media.push({ type: m.type, url: m.url, extension: 'mp4', thumbnail: m.thumbnail_url ?? '' });
    }
  }
  return {
    tweetId: tweet.id ?? id,
    author: tweet.author?.screen_name ?? 'unknown',
    authorName: tweet.author?.name ?? '',
    text: tweet.text ?? '',
    media,
  };
}

async function getJson(url: string): Promise<any> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchTweetMedia(id: string): Promise<TweetMedia> {
  let firstError: unknown;
  try {
    const json = await getJson(
      `https://cdn.syndication.twimg.com/tweet-result?id=${id}&lang=en&token=${syndicationToken(id)}`,
    );
    const result = parseSyndication(id, json);
    if (result.media.length) return result;
  } catch (e) {
    firstError = e;
  }
  try {
    const result = parseFxTwitter(id, await getJson(`https://api.fxtwitter.com/status/${id}`));
    if (!result.media.length) throw new Error('Ten tweet nie zawiera zdjęć ani filmów.');
    return result;
  } catch (e) {
    throw e instanceof Error ? e : firstError instanceof Error ? firstError : new Error('Nie udało się pobrać tweeta.');
  }
}
