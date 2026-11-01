# How Alcove is put together

This is a map of the code for a later walkthrough. The TV runs one web page. There is no build step for the JavaScript. `ares-package` wraps the `app` folder into an `.ipk`.

Scripts load in the order listed in `app/index.html`. Each file adds functions to one shared object, `window.Alcove`. Unit tests load the same files in Node, without a browser.

## Boot

`app/js/main.js` starts after the page loads.

1. Read settings from `localStorage` (`alcove.settings.v1`).
2. If the page was opened with `?mock=1` and the server fields are empty, point them at the desktop stand-in.
3. If a previous visit saved a photo list, show that list immediately.
4. Build the wall, the decoration layer, the clock, and the music player.
5. If a server URL and API key are saved, ask Immich for fresh photos. If that fails, keep the saved list and show **Offline**.

Settings open on their own when the URL or key is missing. Yellow (or S on a keyboard) opens them later.

## Settings

`app/js/settings.js` holds the defaults and the rules that clean saved values: allowed layouts, number ranges, the junk-query list, and the music block. `redactSettings` replaces the API key and music passwords with `***` before anything is printed.

`app/js/settings-ui.js` draws the two-pane screen. The left pane is a section. The right pane is the rows for that section. Up and down move. Left and right change a number or a choice. OK runs a button, focuses a text field, or opens a picker. Back closes the picker, then the screen.

The on-screen keyboard appears when a text field is focused. That is the LG keyboard on a TV.

## Talking to Immich

`app/js/immich.js` is the only place that knows Immich URLs. The TV stores a base such as `http://192.168.x.x:2283`. Requests go to `{base}/api/...` with the header `x-api-key`.

Calls Alcove actually makes:

| Need | Request |
| --- | --- |
| Connection test | `GET /api/users/me` (needs `user.read`) |
| All photos | `POST /api/search/random` (a sample; metadata search is the fallback) |
| Favorites, albums, people | `POST /api/search/metadata` |
| One folder | `GET /api/view/folder?path=` |
| Folder list | `GET /api/view/folder/unique-paths` |
| On this day | `GET /api/memories?type=on_this_day&for=YYYY-MM-DD` |
| Album and people names | `GET /api/albums`, `GET /api/people` |
| Junk list | `POST /api/search/smart` |
| The picture | `GET /api/assets/{id}/thumbnail?size=preview` |

Search still uses the flat fields (`type`, `isFavorite`, `albumIds`, `personIds`, `visibility`, `withExif`, `withPeople`). Immich v3 accepts those fields. v3.2 adds a newer `filter` object and marks the flat fields deprecated. They keep working until a future major version.

`normalizeAsset` copies only fields the server really returns: type, visibility, favorite, archived, trashed, file name, path, EXIF width, height, rating, city, state, description, people, and tags. Star rating lives on `exifInfo.rating`. There is no separate blur score.

`app/js/probe.js` classifies the `users/me` response. A 401 means the key was refused. A 403 means a permission is missing. A key that is too short, or that contains a space or a character outside letters, digits, `_`, and `-`, is rejected before any request. If the normal request throws and a `no-cors` request still reaches the host, the TV is blocking the response (CORS). If both fail, the server is unreachable.

`app/js/settings.js` can fill a blank server URL and a blank API key from `app/config.local.json` when that file was packaged. A value already saved on the TV wins. The example key in `app/config.local.example.json` is too short to apply.

`app/js/awake.js` asks webOS not to start its screensaver. It subscribes to `luna://com.webos.service.tvpower/power` `registerScreenSaverRequest` with `subscribe: true` and `clientName: com.ethan.alcove`, then answers every timestamped request with `responseScreenSaverRequest`, `ack: false`, and that same timestamp. A 1-pixel looping H.264 file (`app/keep-awake.mp4`) plays at the same time, and restarts if it stalls. Music uses the same kind of inline `<video>` element, which webOS treats as media playback. The browser and `?mock=1` skip all of this. The setting is `keepAwake`, on by default. webOS 25 does not enforce Luna access groups, and LG's published group list does not name this tvpower method, so `requiredACG` stays empty.

## What gets shown

`app/js/library.js` fans out to the selected sources, keeps going when one source fails, and drops duplicate ids.

`app/js/filters.js` then drops anything that should not be on the wall:

- videos, archived, hidden, locked, trashed
- file names, paths, or tags that look like screenshots
- photos below the short-edge setting, when EXIF size is present
- photos under the star setting, when a rating is present
- a tag name you typed, matched against `tag.name` or the end of `tag.value`
- ids in the junk set

People-only skips a photo when Immich sent an empty people list. If the people field was missing, the photo stays, because the server did not say it was empty.

`app/js/junk.js` runs smart search for each phrase, keeps the first N ids (the rank order Immich returns), and stores them in `localStorage`. It refreshes when the phrase list changes and once a day. Smart search does not send a similarity score, so N is the cutoff.

`app/js/playlist.js` shuffles that pool. The next photo is one that is outside the recent window when the pool is large enough, and it prefers a portrait or landscape if the slot asked for one.

`app/js/layouts.js` turns the layout name into rectangles with a margin of wall around them. Mixed collage uses one of four fixed arrangements (`left`, `right`, `center`, `stack`). A slot keeps its position, size, and orientation until the arrangement changes. `fitInBox` may shrink that one mat so the photo's aspect fits, anchored in the same slot. EXIF width and height are used, swapped when orientation is 5, 6, 7, or 8. The clock zone in the bottom right stays empty. The season background is a CSS class on the frame (`.theme-christmas` and the others). Christmas also draws a ribbon and bow on each mat, outside the picture.

`app/js/schedule.js` picks the slot that has been up the longest. The gap between swaps is the per-photo time divided by the number of slots, so five prints at 45 seconds change about every 9 seconds and each photo stays up for the full time. A single print just uses the display time. Arrangements advance about every 10 minutes.

`app/js/preload.js` loads and decodes the next image off-screen (`new Image()`, then `img.decode()` when it exists). A failed load is dropped and the next asset is tried. The queue keeps only the upcoming ids and revokes the rest.

`app/js/wall.js` owns the slots. The whole print, including the mat, shadow, and gift ribbon, slides with a CSS transform. The next photo is decoded before it is shown. Ken Burns is a CSS animation on the visible image. Changing arrangements fades the wall only after every new photo has decoded.

## Pictures and memory

`app/js/images.js` fetches the preview with the API key and turns the bytes into an object URL (`URL.createObjectURL`). Each on-screen image holds one pin. When a tile replaces that image, it releases the pin. Unpinned URLs past the cap are revoked with `URL.revokeObjectURL`. A photo still on screen is never revoked.

`app/js/offline.js` keeps a small copy of those bytes in memory and, when the TV has it, in IndexedDB. The asset list itself (ids and captions, up to 80) is also saved in `localStorage`. The next launch can paint from that cache before the network answers.

`app/js/retry.js` waits longer after each failure (half a second, then one, then two, up to a cap) and does not retry a 4xx response.

## Chrome on top of the photos

`app/js/decorations.js` fills a layer with snow, leaves, petals, lights, or a summer wash. Auto mode uses the date in `app/js/util.js`. Christmas is December 1 through January 6 and wins over winter. The rest of the year is northern-hemisphere seasons. The bits move with CSS transforms.

`app/js/display.js` formats the clock and computes a slow x/y shift for burn-in. `main.js` applies that shift to the clock and badges, and sets the night overlay between the hours in settings. The same night flag lowers the music.

`app/js/remote.js` listens for keys. Inside settings, the settings screen handles them. On the frame, left and right skip, OK pauses, Yellow opens settings, Blue mutes music, and Back calls `PalmSystem.platformBack()` so the TV can leave the app.

## Music

Music does not restart when a photo changes. `app/js/music.js` keeps two `<audio>` elements and crossfades between them. The season comes from the active decoration.

- Navidrome (`app/js/navidrome.js`) uses the Subsonic API. The password is turned into an MD5 token (`app/js/md5.js`) plus a salt. The raw password is not put in the stream URL.
- Jellyfin (`app/js/jellyfin.js`) signs in, lists playlists, and plays `/Audio/{id}/stream`. The access token stays in memory for the session.
- Radio plays a URL you typed. A stream tied to the current season wins. Otherwise a stream marked for any season is used.

A stream error waits and retries, then skips. Mute sets the volume to zero. Night multiplies it by 0.35.

## Desktop preview and tests

`tools/dev-server.js` serves `app/` and answers a small Immich, Navidrome, and Jellyfin stand-in on port 8787. `npm test` loads the pure modules and checks playlist spacing, tile timing, filters, settings, retry, junk rank, offline eviction, and music season choice. It does not open a TV.

## Packaging

`app/appinfo.json` is the app id `com.ethan.alcove`. Icons are `app/icon.png` and `app/largeIcon.png`. `npm run package` runs `ares-package` with minification off, and writes `dist/com.ethan.alcove_1.0.0_all.ipk`. Tests, the dev server, and this file stay outside the package because the command is pointed at `app/`.
