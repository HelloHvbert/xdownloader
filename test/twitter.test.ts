import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTweetId, syndicationToken, parseSyndication, parseFxTwitter, bestMp4 } from '../src/twitter.ts';

test('parseTweetId', () => {
  assert.equal(parseTweetId('https://x.com/jack/status/20'), null); // too short id
  assert.equal(parseTweetId('https://x.com/user/status/1790000000000000000?s=20'), '1790000000000000000');
  assert.equal(parseTweetId('https://twitter.com/user/status/1790000000000000000/photo/1'), '1790000000000000000');
  assert.equal(parseTweetId('mobile.twitter.com/u/status/1790000000000000001'), '1790000000000000001');
  assert.equal(parseTweetId('Zobacz to https://fxtwitter.com/u/status/1790000000000000002 xD'), '1790000000000000002');
  assert.equal(parseTweetId('1790000000000000003'), '1790000000000000003');
  assert.equal(parseTweetId('https://evil.com/u/status/1790000000000000000'), null);
  assert.equal(parseTweetId('hello'), null);
});

test('syndicationToken is a non-empty base36 string', () => {
  const t = syndicationToken('1790000000000000000');
  assert.match(t, /^[0-9a-z]+$/);
});

test('bestMp4 picks highest bitrate mp4', () => {
  assert.equal(bestMp4([
    { content_type: 'application/x-mpegURL', url: 'a.m3u8' },
    { bitrate: 256000, content_type: 'video/mp4', url: 'low.mp4' },
    { bitrate: 2176000, content_type: 'video/mp4', url: 'high.mp4' },
  ]), 'high.mp4');
});

test('parseSyndication', () => {
  const r = parseSyndication('1', {
    __typename: 'Tweet', id_str: '1790000000000000000', text: 'hi',
    user: { screen_name: 'alice', name: 'Alice' },
    mediaDetails: [
      { type: 'photo', media_url_https: 'https://pbs.twimg.com/media/ABC.jpg' },
      { type: 'video', media_url_https: 'https://pbs.twimg.com/thumb.jpg', video_info: { variants: [{ bitrate: 1, content_type: 'video/mp4', url: 'v.mp4' }] } },
    ],
  });
  assert.equal(r.author, 'alice');
  assert.equal(r.media[0].url, 'https://pbs.twimg.com/media/ABC?format=jpg&name=orig');
  assert.equal(r.media[1].url, 'v.mp4');
  assert.throws(() => parseSyndication('1', { __typename: 'TweetTombstone' }));
});

test('parseFxTwitter', () => {
  const r = parseFxTwitter('1', { code: 200, tweet: { id: '9', text: 't', author: { screen_name: 'bob', name: 'Bob' },
    media: { all: [{ type: 'gif', url: 'g.mp4', thumbnail_url: 't.jpg' }, { type: 'photo', url: 'https://pbs.twimg.com/media/X.png' }] } } });
  assert.deepEqual(r.media.map((m) => m.type), ['gif', 'photo']);
  assert.equal(r.media[1].extension, 'png');
});
