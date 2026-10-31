# Build brief: Immich photo wall for LG webOS TV

Build a personal LG webOS TV app: an ambient photo frame and "wall of photos" for a big TV, pulling photos from Ethan's self-hosted Immich server. Private, single-user app. Commit after each working milestone.

## Environment
- Immich runs on an Ubuntu laptop on the home LAN at http://home-server:2283 / 192.168.1.66:2283 (DHCP, may change). The TV cannot run Tailscale, so the server URL must be editable on the TV.
- The laptop's Wi-Fi is flaky, so the frame must keep showing photos while offline and recover on its own.
- TV: Ethan's LG is about one year old (bought around late 2025), so it should be a 2025 model on webOS 25 (webOS 10 era, recent Chromium) with built-in AirPlay 2. Target that first; installed apps there should not hit CORS. Keep code reasonably compatible with older webOS (webOS 6+) where cheap, and state the real minimum.
- CORS: packaged webOS apps run from file://, Immich sends no CORS headers. webOS 10+ bypasses CORS for installed apps, older firmware enforces it. Detect the failure with a clear message and include a ready-to-use reverse proxy config (Caddy or nginx) for the home server.

## Features
1. Packaged webOS app that builds an .ipk with `ares-package`.
2. Remote-friendly settings screen: server URL, API key (typed on the TV, stored locally, never committed or logged; document minimal read-only key permissions), sources, layout, timing, decorations, filters, overlays.
3. Photo wall: several photos at once, each tile on its own staggered timer. Layout picker: single, 2-up, 3-up mosaic, 4-grid, mixed collage for portrait and landscape. Crossfades, optional Ken Burns, preview-size images.
4. Sources: albums, favorites, people, folders (Immich folder view API, verify what exists), on-this-day memories if supported. Images only, shuffled without near repeats.
5. Seasonal decorations: Christmas, winter, fall, spring, summer, auto by date, none. Light effects such as gentle snowfall that stay smooth on old hardware.
6. Quality filters: people-only option; exclude archived, hidden, trashed and screenshots if detectable; skip low resolution; drop blurry or junk photos using only what Immich really exposes (faces, tags, ratings, smart search, EXIF), such as a minimum star rating and excluding a chosen tag like "blurry". Don't invent API fields.
   Smart-search junk filter (Ethan confirmed Immich smart search for "blurry" or "black" returns mostly such photos): periodically run Immich smart search (POST /search/smart, CLIP) for a user-editable list of junk queries (defaults: "blurry photo", "black photo", "dark underexposed photo", "screenshot", "receipt", "document"), take the top results per query (configurable count or similarity cutoff, since smart search ranks everything and returns no confidence score), and keep those asset IDs in a cached exclude set the playlist skips. Refresh it daily and when settings change. Expose it in settings with on/off, the query list, and how many results per query to exclude.

7. Fetch images with the API key header into object URLs and revoke them. No memory growth over days.
8. Preload, small offline cache, retry with backoff, subtle offline indicator.
9. Optional clock and captions, night dimming, burn-in avoidance.
10. Remote: left/right skip, OK pause, a key for settings, Back per webOS conventions.
11. Desktop dev mode with a mocked Immich API, plus unit tests (playlist, tile timing, filters, settings, retry).
12. README: Mac install steps (webOS CLI, Developer Mode on the TV, add device, package, install, launch, Developer Mode renewal), DHCP reservation, CORS proxy setup.
13. Background music (optional, off by default), two sources selectable in settings:
   a. Local music server on the home laptop: Navidrome (Subsonic API) first, Jellyfin as a second adapter if simple. Server URL and credentials typed on the TV, stored locally, never committed. User picks playlists per season; "auto" follows the active decoration (e.g. Christmas decorations play the Christmas playlist). Shuffle, loop, crossfade between tracks.
   b. Internet radio: a list of user-entered stream URLs (MP3/AAC/HLS where the TV supports it), each optionally tied to a season, with a few editable example presets (no hardcoded stations that may break).
   Shared: volume, mute key on the remote, fade out during night dimming and back in, keep playing across photo changes, recover after network drops, no memory growth. Use the standard HTML5 audio element. README: how to install Navidrome on the Ubuntu laptop (Docker) and organize seasonal playlists. No YouTube (terms) and no AirPlay integration; note in README that a phone can AirPlay/Bluetooth to a separate speaker instead.
14. ARCHITECTURE.md: short, beginner-friendly explanation of modules and data flow, for a code walkthrough later.

## Constraints
No secrets in the repo, no em dashes in user-facing copy or docs, minimal dependencies.

## When done, report
What you verified, what still needs a real TV, which Immich quality signals exist, and decisions Ethan might want to change.
