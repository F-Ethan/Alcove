# Alcove

Alcove is an ambient photo frame for an LG webOS TV. It plays stills from a self-hosted Immich server on the home LAN, and it can play music from Navidrome, Jellyfin, or a stream URL you type on the TV.

The server address, API key, and music password are typed on the TV and stored in the app's local storage. None of those belong in this repo.

## What you need

- An LG TV. This build targets webOS 25 (2025 models, the webOS 10 era). The page also runs on webOS 6 and newer. webOS 4 and older are outside the target.
- Immich on the laptop, at a URL the TV can open, such as `http://192.168.1.66:2283`.
- A Mac with Node.js 18 or newer, for the webOS CLI.
- The TV and the laptop on the same LAN. The TV does not use Tailscale, so the URL has to be a LAN address.

Installed apps on webOS 25 call Immich directly. Immich does not send CORS headers. Older webOS still enforces CORS. The connection test in settings tells you when that happens, and the proxy samples below are the fallback.

## Install the webOS CLI on a Mac

```bash
npm install -g @webos-tools/cli@3.2.6
```

The project also depends on that CLI, so `npm run package` works after `npm install` in this repo.

## Turn on Developer Mode

1. On the TV, open the LG Content Store and install **Developer Mode**.
2. Sign in with your LG developer account. Create one at https://webostv.developer.lge.com if you need it.
3. Open Developer Mode and turn **Dev Mode Status** on. The TV reboots.
4. Open Developer Mode again. Note the IP address and the 6-character passphrase. Turn **Key Server** on when the Mac asks for the key.

The session lasts up to 1000 hours. The app shows the time left in **Remain Session**. Extend it while the TV is on the network, from the EXTEND button on the TV, or from the Mac:

```bash
ares-launch com.palmdts.devmode -p '{"extend":true}' -d living-room
```

When the session hits zero, or the TV reboots ten times while it is off the network, Developer Mode turns off and the sideloaded app is removed. Extend the session before you travel.

## Add the TV

```bash
ares-setup-device
```

Choose **add** and enter:

| Prompt | Value |
| --- | --- |
| Device name | `living-room` |
| IP address | the address shown in Developer Mode |
| Port | `9922` |
| SSH user | `prisoner` |
| Default | yes |

On the TV, press **Key Server**. Then on the Mac:

```bash
ares-novacom --device living-room --getkey
ares-device --system-info --device living-room
```

Type the passphrase exactly as the TV shows it. `ares-device` prints the model and webOS version when the key is in place.

## Build, install, and launch

From this repo:

```bash
npm install
npm test
npm run package
ares-install --device living-room dist/com.ethan.alcove_1.0.0_all.ipk
ares-launch --device living-room com.ethan.alcove
```

`npm run package` runs `ares-package ./app -o dist --no-minify` and writes `dist/com.ethan.alcove_1.0.0_all.ipk`.

Launch it again later with:

```bash
ares-launch --device living-room com.ethan.alcove
```

Remove it with:

```bash
ares-install --device living-room --remove com.ethan.alcove
```

## First launch

Press **Yellow** for settings. A USB keyboard can press **S**.

- Server URL: `http://192.168.1.66:2283`. A trailing `/api` is optional.
- All photos is on by default. That is a random sample of the library, so the wall still fills when you have no favorites. If the wall is empty, it lists how many photos each source returned, how many each filter removed, and any HTTP error such as a missing API permission.
- API key: type it with the on-screen keyboard.

In Immich, open Account settings, API Keys, and create a key with only these permissions:

- `asset.read`
- `asset.view` (thumbnail previews)
- `album.read`
- `person.read`
- `folder.read`
- `memory.read`
- `tag.read`

The key stays on the TV. Alcove sends it as the `x-api-key` header and does not print it.

While the frame is up:

| Key | Action |
| --- | --- |
| Right | Next photos |
| Left | Previous photos |
| OK | Pause or resume |
| Yellow | Settings |
| Back | Close settings, or leave the app for the TV home |
| Blue | Mute or unmute music |

Arrows, OK, and Back inside settings change rows, edit a value, and step back. Left and right change numbers and lists.

## Keep the laptop address stable

`192.168.1.66` is a DHCP address and it can move. On the router, reserve that address for the laptop's Wi-Fi MAC. If it still changes, edit the server URL on the TV. Alcove keeps the last photos on screen while the laptop is unreachable and tries again with backoff.

## CORS proxy

On webOS 25 the installed app is allowed to read Immich's responses. On older firmware the TV can reach the server and still block the response, because Immich does not send `Access-Control-Allow-Origin`. Settings says so when a no-cors probe succeeds and the real request fails.

Run one of the sample proxies on the laptop and point Alcove at it, for example `http://192.168.1.66:2284`.

- `proxy/Caddyfile` listens on port 2284 and forwards to Immich on 2283.
- `proxy/nginx.conf` does the same.

The key is a header, so the wildcard origin is enough. Restart Caddy or nginx after you copy the file, and open the proxy URL once from a laptop browser to confirm Immich answers.

Caddy:

```bash
caddy run --config proxy/Caddyfile
```

nginx:

```bash
sudo nginx -c "$(pwd)/proxy/nginx.conf"
```

The nginx file uses a prefix path under `/tmp` for its pid. Adjust `pid` if your system nginx is already running and you want this as an extra server block instead of a standalone process.

## Desktop preview

```bash
npm test
npm run dev
```

Open http://127.0.0.1:8787/?mock=1

The preview serves a small stand-in Immich so layouts, filters, and the remote keys can be tried away from the TV. It is not the home library. `?mock=1` fills the server URL with the preview origin and a stand-in key when those fields are empty.

## Navidrome

Music is off until you enable it in settings. Alcove can use:

- Navidrome on the laptop, through the Subsonic API
- Jellyfin, through its playlist and audio stream API
- Internet radio: MP3 or AAC URLs you type in. HLS plays only when that TV's browser already supports it.

There is no YouTube source. Alcove does not join AirPlay. A phone can AirPlay or use Bluetooth to a separate speaker if you want the sound off the TV.

On the Ubuntu laptop, Navidrome in Docker:

```yaml
services:
  navidrome:
    image: deluan/navidrome:latest
    user: "1000:1000"
    ports:
      - "4533:4533"
    environment:
      ND_MUSICFOLDER: /music
      ND_DATAFOLDER: /data
    volumes:
      - ./music:/music
      - ./data:/data
    restart: unless-stopped
```

```bash
mkdir -p music data
docker compose up -d
```

Open `http://192.168.1.66:4533`, create a user, and copy audio files into `music`. In Navidrome, build playlists for the seasons you want (Christmas, Winter, Fall, Spring, Summer, plus one for when decorations are off).

On the TV, set the Navidrome URL, username, and password, run **Test music**, and pick one playlist per season. With decorations on Auto, Christmas (December 1 through January 6) plays the Christmas playlist, and the other seasons follow the date. Tracks shuffle, loop, and crossfade. The password stays on the TV and is not written to the log.

Internet radio is a list of name, URL, and season. The rows start empty so a dead station is not baked in. Edit them on the TV.

Jellyfin is the other server choice. It uses the same season slots. Alcove signs in when playback starts and keeps the access token in memory for that session.

Night dimming lowers the music with the picture and brings it back in the morning. A dropped stream retries, then skips ahead. Two audio elements are reused, so a long session does not keep allocating players.

## Tests

```bash
npm test
```

The tests cover the playlist, tile timing, filters, settings, retry, the junk list, and which playlist or stream a season selects.

## Where the code lives

`ARCHITECTURE.md` walks through the modules and the path from a remote key to a photo on screen.
