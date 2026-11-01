# Alcove

Alcove is a photo frame for an LG TV. It hangs stills from your own Immich server on the wall, the way a frame sits in a room. You sideload it with LG's developer tools. You do not need a listing in the LG Content Store.

## What it does

- **Layouts.** Single, 2-up, 3-up mosaic, 4-grid, and a mixed collage. Each frame follows the photo. A landscape stays landscape, a portrait stays portrait, and nothing is cropped into the wrong shape. The collage hangs about five prints with air around them: one large portrait, a landscape beside or below it, and three smaller prints. The prints stay put while they are up. About every 10 minutes the mixed collage eases into a different arrangement. The clock sits in a clear spot at the bottom right.
- **Seasonal themes.** Auto follows the date. You can also pick Christmas, winter, fall, spring, summer, or none. Christmas uses wrapping paper behind the prints, with a ribbon and a bow on the mat, not across the photo. Auto treats December 1 through January 6 as Christmas.
- **Smart filtering.** All photos, favorites, albums, people, folders, and On this day. Optional filters drop screenshots, tiny photos, low star ratings, a tag you name, and the top matches from Immich smart search (blurry, receipts, and similar).
- **Optional music.** Off until you turn it on. Navidrome, Jellyfin, or an internet radio URL. A playlist or stream can follow the season.
- **Keep awake.** On by default. Alcove asks webOS not to start the screensaver while the wall is up.

One photo changes at a time. Each one stays up for about 45 seconds, then slides out as the next slides in. A gentle Ken Burns move plays while it is up. A clock, captions, night dimming, and a slow shift that helps with burn-in are included.

## What you need

1. **An Immich server the TV can reach.** On the home network that is a LAN address, for example `http://192.168.x.x:2283`. A trailing `/api` is optional. If the TV reaches Immich through a reverse proxy, Tailscale, or another remote path, use the `https://` address that path already serves. The TV has to trust the certificate. A self-signed certificate that the TV does not trust will fail the same way a dead server does. Alcove does not add its own TLS.
2. **An LG TV on webOS.** This build was tried on a 2025 set running webOS 25. Installed apps on that version can call Immich directly. Older sets sometimes block the response (CORS). The connection test says so, and sample proxy configs live in `proxy/`.
3. **A computer with Node.js 18 or newer.** That is where you build the package and talk to the TV. macOS, Linux, and Windows all work with the same commands.
4. **The LG Developer Mode app**, from the LG Content Store, signed in with an [LG developer account](https://webostv.developer.lge.com). Developer Mode is a session. It expires. When it expires, webOS removes sideloaded apps, including Alcove. Extend the session before that happens. The steps are below.

The server address and API key can be typed on the TV. They can also be baked into the package from a file that stays on your computer. Neither belongs in git. This repository is public.

## Create an Immich API key

An API key is not your Immich password. Immich keys are long strings of letters, digits, `_`, and `-`, usually around 40 characters or more. Alcove rejects anything shorter than 30 characters, anything with a space, and anything outside that character set, and it tells you it looks like a password.

1. Open Immich in a browser and sign in.
2. Open **Account Settings**, then **API Keys**.
3. Create a key and enable only these permissions. They match the calls Alcove makes:

   - `asset.read` for search (all photos, favorites, albums, people, and the smart-search junk list)
   - `asset.view` for preview thumbnails
   - `album.read` for the album list
   - `person.read` for the people list
   - `folder.read` for the folder list and folder photos
   - `memory.read` for On this day
   - `tag.read` so tag names are available for the exclude-tag filter
   - `user.read` for the connection test, which calls `GET /api/users/me`

4. Copy the key once and store it somewhere private. Never commit it, and never paste it into a pull request, a screenshot, or `app/config.local.example.json`.

If your Immich build only offers a single permission named `all`, that key works too. Newer servers list the names above one by one. `user.read` is what `GET /api/users/me` asks for, so Test connection returns 403 without it even when the photo permissions are already on.

## Set up the TV

1. On the TV, install **Developer Mode** from the LG Content Store.
2. Sign in. If you need an account, create one at https://webostv.developer.lge.com.
3. Turn **Dev Mode Status** on. The TV reboots.
4. Open Developer Mode again. Write down the **IP address** and the passphrase. Leave this screen up. Turn **Key Server** on when the computer asks for the key.
5. Note the time left under **Remain Session**. The session lasts up to 1000 hours. Extend it from the **EXTEND** button on the TV, or later from the computer:

```bash
ares-launch com.palmdts.devmode -p '{"extend":true}' -d lg-tv
```

If the session hits zero, or the TV reboots ten times while Developer Mode cannot reach the network, Developer Mode turns off and Alcove is removed. Extend it while the TV is on the network, including before you travel.

On the computer, install the webOS CLI. This project was checked with version 3.2.6, which is also the version `npm install` pulls in for packaging:

```bash
npm i -g @webos-tools/cli@3.2.6
```

Add the TV. The name `lg-tv` is only a label on your computer. Use another name if you prefer, and use that same name in every command below.

```bash
ares-setup-device
```

Choose **add** and answer the prompts:

| Prompt | Value |
| --- | --- |
| Device name | `lg-tv` |
| IP address | the address shown in Developer Mode |
| Port | `9922` |
| SSH user | `prisoner` |
| Default | yes |

On the TV, turn **Key Server** on. Then fetch the key and confirm the set answers. Type the passphrase exactly as the TV shows it.

```bash
ares-novacom --device lg-tv --getkey
ares-device --system-info --device lg-tv
```

`ares-device` prints the model and the webOS version when the key is in place.

## Build and install

```bash
git clone https://github.com/F-Ethan/Alcove.git
cd Alcove
npm install
```

You can skip the next file and type the server URL and key on the TV instead. To avoid the on-screen keyboard, copy the example and edit the copy before you package:

```bash
cp app/config.local.example.json app/config.local.json
```

`app/config.local.json` is gitignored. `npm run package` packs the `app` folder, so the file is inside the ipk when it is present. The example file is only a shape. Its key is a short placeholder, and Alcove ignores a placeholder that fails the key check.

```json
{
  "serverUrl": "http://192.168.x.x:2283",
  "apiKey": "paste-your-immich-api-key"
}
```

Replace both values with your server and the key you just created. `serverUrl` must start with `http://` or `https://`. A value you later save on the TV wins. The file fills only a blank server URL or a blank API key.

Package, install, and launch:

```bash
npm run package
ares-install --device lg-tv dist/com.ethan.alcove_1.0.0_all.ipk
ares-launch --device lg-tv com.ethan.alcove
```

`npm run package` runs `ares-package ./app -o dist --no-minify` and writes `dist/com.ethan.alcove_1.0.0_all.ipk`. The app id is `com.ethan.alcove`.

Launch it again later with:

```bash
ares-launch --device lg-tv com.ethan.alcove
```

Remove it with:

```bash
ares-install --device lg-tv --remove com.ethan.alcove
```

## First run

Settings open on their own when the server URL or the API key is missing. After that, **Yellow** opens settings. A USB keyboard can press **S**.

The on-screen hint on the wall is: Yellow opens settings. OK pauses.

| Key | On the wall |
| --- | --- |
| Right | Next photos |
| Left | Previous photos |
| OK | Pause or resume |
| Yellow | Settings |
| Back | Leave the app for the TV home |
| Blue | Mute or unmute music |

Inside settings, Up and Down move. Left and Right change a number or a choice. OK runs a button, focuses a text field, or opens a picker. Back steps out of a picker, then closes settings.

On the **Immich** page:

1. Set **Server URL** to the address the TV can open, such as `http://192.168.x.x:2283`.
2. Set **API key**. The field is plain text so a long key is easier to check. Press Right to move to **Show** or **Hide**, then OK to toggle it. Music passwords stay hidden until you do the same.
3. Run **Test connection**. A good key says **Connected.** and Alcove starts loading the library.

On the **Sources** page, **All photos** and **Favorites** start on. All photos is a random sample of the library (250 photos), so the wall can fill even when you have no favorites. **On this day** starts off. Albums, people, and folders start empty. Open one of those rows after a successful test, then pick items with OK. If a list says nothing is loaded yet, run Test connection and open it again.

The other pages are Layout, Decorations, Filters, Display, and Music. **Keep TV awake** is on the Display page and starts on.

## Optional music

Music stays off until you enable **Background music**. Pick a source:

- **Navidrome.** Set the URL (often `http://192.168.x.x:4533`), the username, and the password. Run **Test music**. That loads playlists. Assign one playlist to each season you care about: Christmas, winter, fall, spring, summer, and one for when decorations are off. With decorations on Auto, Christmas (December 1 through January 6) uses the Christmas playlist, and the other seasons follow the date. Alcove talks to Navidrome through the Subsonic API. The password is stored on the TV and is not written to the log.
- **Jellyfin.** Same idea, with the Jellyfin URL (often `http://192.168.x.x:8096`), username, and password. Alcove signs in when playback starts and keeps that access token in memory for the session.
- **Internet radio.** Add up to 8 streams. Each row is a name, a URL, and a season. MP3 or AAC is the reliable choice. Leave a URL empty to skip that row. A stream tied to the current season wins. Otherwise a stream marked for any season is used. The rows start empty so a dead station is not baked in.

Tracks shuffle, loop, and crossfade. Night dimming lowers the music with the picture. There is no YouTube source.

## Troubleshooting

**"That looks like a password, not an API key."** The text is shorter than 30 characters, has a space, or has a character other than letters, digits, `_`, and `-`. Create a key under Account Settings, API Keys. Do not type your Immich password.

**"The API key was refused."** Immich returned 401. The key was mistyped, revoked, or is not the key Immich issued. Create a new one and paste it again. Check Show so you can see the whole string.

**"A permission is missing."** Immich returned 403. The key signed in, and one of the permissions in the list above is off. Edit the key in Immich and enable the one you skipped. `user.read` is the one the connection test needs. The others are what the wall needs. An empty wall can also name the missing permission next to a source, for example `403 missing permission asset.read`.

**The wall is empty.** A note on the frame lists each source, how many photos it returned, any HTTP error, how many photos the filters kept, and why the rest were dropped. Favorites can be empty if you have not starred anything. All photos should still fill the wall. If the junk filter count looks too high, turn **Smart search junk filter** off under Filters.

**The TV goes to the screensaver.** Keep TV awake should be on. On the TV, a line at the lower left reads `Keep awake: luna=ok, video=playing` when both layers are up, or `fail` and `stopped` when they are not. Luna subscribes with the app id as `clientName` and answers each screensaver request with `ack: false` and the same timestamp. A tiny looping video also plays as a 1-pixel dot, and music plays through a video element. That handshake can only be confirmed on the TV. In a desktop browser, and with `?mock=1`, Alcove does not try it.

**The app disappeared.** Developer Mode expired or was turned off, and webOS removed the sideload. Extend or turn the session back on, then install again with the `ares-install` command above.

**The server moved.** DHCP can change a LAN address. Reserve it on the router, or edit Server URL on the TV. Alcove keeps the last photos on screen while the server is unreachable, shows **Offline**, and tries again with backoff.

**CORS on an older set.** The test says the TV can reach the server but the browser blocked the response. Point Alcove at a reverse proxy that adds `Access-Control-Allow-Origin`. `proxy/Caddyfile` and `proxy/nginx.conf` listen on port 2284 and forward to Immich on 127.0.0.1:2283. webOS 25 usually does not need this.

```bash
caddy run --config proxy/Caddyfile
```

```bash
sudo nginx -c "$(pwd)/proxy/nginx.conf"
```

Then set the server URL to `http://192.168.x.x:2284`.

**Update Alcove** after you pull new code. Your saved settings stay on the TV. If `app/config.local.json` changed, package again so the new file is inside the ipk. A URL or key already saved on the TV is left as-is.

```bash
git pull
npm install
npm run package
ares-install --device lg-tv dist/com.ethan.alcove_1.0.0_all.ipk
ares-launch --device lg-tv com.ethan.alcove
```

## Development

From the repo:

```bash
npm test
npm run dev
```

`npm test` runs `node --test test/*.test.js`. The tests cover the playlist, layouts, frame aspect, the API key check, the connection probe, filters, settings, and music season choice. They do not open a TV.

`npm run dev` serves the app and a small stand-in Immich on port 8787. Open:

```text
http://127.0.0.1:8787/?mock=1
```

Add `&decor=christmas` to preview the wrapping paper:

```text
http://127.0.0.1:8787/?mock=1&decor=christmas
```

`?mock=1` fills an empty server URL with the preview origin and a stand-in key. It is not your library. Arrow keys, Enter, and S stand in for the remote.

`ARCHITECTURE.md` is a map of the modules if you want to change the code.

Icons can be regenerated with `npm run icons` (Python 3).
