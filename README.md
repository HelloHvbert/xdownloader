# XDownloader

Prosta aplikacja mobilna (Expo / React Native) do pobierania zdjęć, filmów i GIF-ów z postów na X/Twitterze.

- pole na link + przycisk **Wklej** ze schowka
- pobiera wszystkie media z posta w najlepszej jakości (zdjęcia w `orig`, filmy w najwyższym bitrate)
- zapisuje do galerii w albumie **XDownloader**
- lokalna historia pobrań (AsyncStorage) — dotknij, aby udostępnić plik, przytrzymaj, aby usunąć
- **Udostępnij → XDownloader** z aplikacji X: link trafia do aplikacji i pobieranie startuje automatycznie
  (Android: intent `SEND text/plain`, iOS: rozszerzenie udostępniania z `expo-sharing`)

Bez logowania i bez klucza API: metadane posta pobierane są z publicznego endpointu embedów Twittera
(`cdn.syndication.twimg.com`), a w razie niepowodzenia z `api.fxtwitter.com`. Prywatne posty i treści z ograniczeniem wieku nie zadziałają.

## Uruchomienie

```bash
npm install
npx expo start
```

Zeskanuj kod QR w **Expo Go** (Android / iOS).
Zapis do galerii przez `expo-media-library` może wymagać development builda zamiast Expo Go:

```bash
npx expo run:android          # lokalnie, wymaga Android SDK
# albo w chmurze:
npx eas-cli@latest build -p android --profile preview   # gotowy plik .apk
```

Odbieranie linków z menu „Udostępnij” wymaga natywnego builda (development lub preview) — w Expo Go nie zadziała.
Na iOS rozszerzenie korzysta z App Group `group.com.hellohvbert.xdownloader`; EAS Build skonfiguruje ją automatycznie.

## Skrypty

```bash
npm test            # testy parsera linków i odpowiedzi API
npm run typecheck   # tsc --noEmit
npm run lint        # expo lint
```

## Struktura

- `App.tsx` – ekran: input, status, historia
- `src/twitter.ts` – parsowanie linku, pobieranie i parsowanie metadanych posta
- `src/download.ts` – pobieranie plików i zapis do galerii
- `src/history.ts` – historia pobrań w pamięci lokalnej
