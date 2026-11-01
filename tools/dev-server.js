#!/usr/bin/env node
/**
 * Desktop preview. Serves the webOS app and a small Immich stand-in.
 * Open http://127.0.0.1:8787/?mock=1
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

function toneWav() {
  const sampleRate = 8000;
  const samples = sampleRate;
  const data = Buffer.alloc(44 + samples * 2);
  data.write('RIFF', 0);
  data.writeUInt32LE(36 + samples * 2, 4);
  data.write('WAVE', 8);
  data.write('fmt ', 12);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(1, 22);
  data.writeUInt32LE(sampleRate, 24);
  data.writeUInt32LE(sampleRate * 2, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write('data', 36);
  data.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i += 1) {
    const value = Math.round(Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 1800);
    data.writeInt16LE(value, 44 + i * 2);
  }
  return data;
}

const tone = toneWav();
const root = path.join(__dirname, '..', 'app');
const port = Number(process.env.PORT) || 8787;

const albums = [
  { id: 'album-trips', albumName: 'Trips', assetCount: 3, assets: [] },
  { id: 'album-home', albumName: 'Home', assetCount: 2, assets: [] }
];

const people = [
  { id: 'person-ada', name: 'Ada', isHidden: false },
  { id: 'person-beau', name: 'Beau', isHidden: false }
];

function photo(fields) {
  return {
    id: fields.id,
    type: fields.type || 'IMAGE',
    originalFileName: fields.name,
    originalPath: fields.path,
    isFavorite: !!fields.favorite,
    isArchived: fields.visibility === 'archive',
    isTrashed: !!fields.trashed,
    visibility: fields.visibility || 'timeline',
    fileCreatedAt: fields.taken || '2024-06-01T15:00:00.000Z',
    localDateTime: fields.taken || '2024-06-01T15:00:00.000Z',
    exifInfo: {
      exifImageWidth: fields.width || 4000,
      exifImageHeight: fields.height || 3000,
      city: fields.city || '',
      state: fields.state || '',
      description: fields.description || '',
      rating: fields.rating == null ? null : fields.rating
    },
    people: fields.people || [],
    tags: fields.tags || [],
    albumIds: fields.albums || []
  };
}

const library = [
  photo({ id: 'coast', name: 'coast.jpg', path: '/photos/trips/coast.jpg', favorite: true, city: 'Mendocino', state: 'California', width: 5000, height: 3200, rating: 5, albums: ['album-trips'], people: [people[0]] }),
  photo({ id: 'porch', name: 'porch.jpg', path: '/photos/home/porch.jpg', favorite: true, city: 'Austin', state: 'Texas', width: 2400, height: 3200, rating: 4, albums: ['album-home'], people: [people[1]] }),
  photo({ id: 'kitchen', name: 'kitchen.jpg', path: '/photos/home/kitchen.jpg', city: 'Austin', state: 'Texas', width: 4600, height: 3000, rating: 4, albums: ['album-home'], people: [people[0], people[1]] }),
  photo({ id: 'ridge', name: 'ridge.jpg', path: '/photos/trips/ridge.jpg', city: 'Estes Park', state: 'Colorado', width: 5200, height: 3400, rating: 5, albums: ['album-trips'] }),
  photo({ id: 'creek', name: 'creek.jpg', path: '/photos/trips/creek.jpg', favorite: true, width: 1800, height: 2600, rating: 3, albums: ['album-trips'], people: [people[0]] }),
  photo({ id: 'screen', name: 'Screenshot_2024.png', path: '/photos/screenshots/Screenshot_2024.png', width: 2000, height: 1200, rating: 1 }),
  photo({ id: 'tiny', name: 'tiny.jpg', path: '/photos/tiny.jpg', width: 320, height: 240, rating: 5, people: [people[1]] }),
  photo({ id: 'archived', name: 'old.jpg', path: '/photos/old.jpg', visibility: 'archive', width: 4000, height: 3000, rating: 5 }),
  photo({ id: 'blur', name: 'soft.jpg', path: '/photos/soft.jpg', width: 4000, height: 3000, rating: 1, tags: [{ id: 'tag-blur', name: 'blurry', value: 'quality/blurry' }], people: [people[0]] }),
  photo({ id: 'junk-black', name: 'black.jpg', path: '/photos/black.jpg', width: 4000, height: 3000, rating: 2 }),
  photo({ id: 'junk-receipt', name: 'receipt.jpg', path: '/photos/receipt.jpg', width: 1200, height: 2000, rating: 2 }),
  photo({ id: 'winter-day', name: 'snow-day.jpg', path: '/photos/memories/snow-day.jpg', city: 'Duluth', state: 'Minnesota', width: 4000, height: 2600, rating: 5, people: [people[1]], taken: '2019-10-31T18:00:00.000Z' })
];

function send(response, status, body, type) {
  const data = Buffer.isBuffer(body) ? body : Buffer.from(body);
  response.writeHead(status, {
    'Content-Type': type || 'application/json',
    'Content-Length': data.length,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'x-api-key, content-type, accept',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Cache-Control': 'no-store'
  });
  response.end(data);
}

function matches(asset, body) {
  if (body.type && asset.type !== body.type) return false;
  if (body.visibility && asset.visibility !== body.visibility) return false;
  if (body.isFavorite != null && asset.isFavorite !== body.isFavorite) return false;
  if (body.albumIds && body.albumIds.length) {
    const wanted = body.albumIds;
    const own = asset.albumIds || [];
    if (!wanted.some(function (id) { return own.indexOf(id) !== -1; })) return false;
  }
  if (body.personIds && body.personIds.length) {
    const ids = (asset.people || []).map(function (person) { return person.id; });
    if (!body.personIds.some(function (id) { return ids.indexOf(id) !== -1; })) return false;
  }
  return true;
}

function publicAsset(asset) {
  const copy = {};
  Object.keys(asset).forEach(function (key) {
    if (key !== 'albumIds') copy[key] = asset[key];
  });
  return copy;
}

function search(body) {
  const items = library.filter(function (asset) { return matches(asset, body || {}); }).map(publicAsset);
  return { albums: { total: 0, count: 0, items: [], facets: [] }, assets: { total: items.length, count: items.length, items: items, facets: [], nextPage: null, nextCursor: null } };
}

function smart(body) {
  const query = String(body && body.query || '').toLowerCase();
  const limit = body && body.size ? body.size : 40;
  let items = [];
  if (query.indexOf('blur') !== -1 || query.indexOf('dark') !== -1 || query.indexOf('black') !== -1) {
    items = library.filter(function (asset) { return asset.id === 'blur' || asset.id === 'junk-black'; });
  } else if (query.indexOf('screenshot') !== -1) {
    items = library.filter(function (asset) { return asset.id === 'screen'; });
  } else if (query.indexOf('receipt') !== -1 || query.indexOf('document') !== -1) {
    items = library.filter(function (asset) { return asset.id === 'junk-receipt'; });
  }
  items = items.slice(0, limit).map(publicAsset);
  return { albums: { total: 0, count: 0, items: [], facets: [] }, assets: { total: items.length, count: items.length, items: items, facets: [], nextPage: null, nextCursor: null } };
}

function svgFor(asset) {
  const width = asset && asset.exifInfo && asset.exifInfo.exifImageWidth > asset.exifInfo.exifImageHeight ? 1600 : 1000;
  const height = width === 1600 ? 1000 : 1500;
  const label = asset ? (asset.exifInfo.city || asset.originalFileName) : 'Missing';
  const hue = asset ? asset.id.length * 40 : 0;
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '"><rect width="100%" height="100%" fill="hsl(' + hue + ', 28%, 32%)"/><text x="50%" y="52%" fill="#f3efe6" font-size="64" text-anchor="middle" font-family="sans-serif">' + label + '</text></svg>';
}

function readBody(request) {
  return new Promise(function (resolve) {
    const chunks = [];
    request.on('data', function (chunk) { chunks.push(chunk); });
    request.on('end', function () {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (err) { resolve({}); }
    });
  });
}

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

function serveFile(response, urlPath) {
  const clean = urlPath === '/' ? '/index.html' : urlPath;
  const file = path.normalize(path.join(root, clean));
  if (file.indexOf(root) !== 0) {
    send(response, 403, 'Forbidden', 'text/plain');
    return;
  }
  fs.readFile(file, function (err, data) {
    if (err) {
      send(response, 404, 'Not found', 'text/plain');
      return;
    }
    send(response, 200, data, types[path.extname(file)] || 'application/octet-stream');
  });
}

const server = http.createServer(function (request, response) {
  const url = new URL(request.url, 'http://127.0.0.1');
  if (request.method === 'OPTIONS') {
    send(response, 204, '');
    return;
  }
  if (url.pathname === '/api/server/ping') {
    send(response, 200, JSON.stringify({ res: 'pong' }));
    return;
  }
  if (url.pathname === '/api/albums') {
    send(response, 200, JSON.stringify(albums));
    return;
  }
  if (url.pathname === '/api/people') {
    send(response, 200, JSON.stringify({ people: people, total: people.length, hidden: 0 }));
    return;
  }
  if (url.pathname === '/api/view/folder/unique-paths') {
    send(response, 200, JSON.stringify(['/photos/trips', '/photos/home']));
    return;
  }
  if (url.pathname === '/api/view/folder') {
    const folder = url.searchParams.get('path') || '';
    const items = library.filter(function (asset) { return asset.originalPath.indexOf(folder) === 0; }).map(publicAsset);
    send(response, 200, JSON.stringify(items));
    return;
  }
  if (url.pathname === '/api/memories') {
    const memory = library.filter(function (asset) { return asset.id === 'winter-day'; }).map(publicAsset);
    send(response, 200, JSON.stringify([{ id: 'memory-1', type: 'on_this_day', data: { year: 2019 }, assets: memory, memoryAt: new Date().toISOString() }]));
    return;
  }
  const thumb = /^\/api\/assets\/([^/]+)\/thumbnail$/.exec(url.pathname);
  if (thumb) {
    const asset = library.filter(function (item) { return item.id === decodeURIComponent(thumb[1]); })[0];
    send(response, asset ? 200 : 404, svgFor(asset), 'image/svg+xml');
    return;
  }
  if (url.pathname === '/api/search/metadata' && request.method === 'POST') {
    readBody(request).then(function (body) { send(response, 200, JSON.stringify(search(body))); });
    return;
  }
  if (url.pathname === '/api/search/random' && request.method === 'POST') {
    readBody(request).then(function (body) {
      const found = search(body).assets.items;
      const size = body && body.size ? body.size : found.length;
      send(response, 200, JSON.stringify(found.slice(0, size)));
    });
    return;
  }
  if (url.pathname === '/api/search/smart' && request.method === 'POST') {
    readBody(request).then(function (body) { send(response, 200, JSON.stringify(smart(body))); });
    return;
  }
  if (url.pathname.indexOf('/api/') === 0) {
    send(response, 404, JSON.stringify({ message: 'No mock for ' + url.pathname }));
    return;
  }
  if (url.pathname === '/rest/ping.view') {
    send(response, 200, JSON.stringify({ 'subsonic-response': { status: 'ok', version: '1.16.1' } }));
    return;
  }
  if (url.pathname === '/rest/getPlaylists.view') {
    send(response, 200, JSON.stringify({ 'subsonic-response': { status: 'ok', version: '1.16.1', playlists: { playlist: [{ id: 'pl-xmas', name: 'Christmas' }, { id: 'pl-quiet', name: 'Quiet' }] } } }));
    return;
  }
  if (url.pathname === '/rest/getPlaylist.view') {
    send(response, 200, JSON.stringify({ 'subsonic-response': { status: 'ok', version: '1.16.1', playlist: { id: url.searchParams.get('id'), entry: [{ id: 'track-1', title: 'Carol' }] } } }));
    return;
  }
  if (url.pathname === '/rest/stream.view') {
    send(response, 200, tone, 'audio/wav');
    return;
  }
  if (url.pathname === '/Users/AuthenticateByName' && request.method === 'POST') {
    send(response, 200, JSON.stringify({ AccessToken: 'dev-token', User: { Id: 'user-1' } }));
    return;
  }
  if (url.pathname === '/Users/user-1/Items') {
    send(response, 200, JSON.stringify({ Items: [{ Id: 'jf-xmas', Name: 'Christmas' }] }));
    return;
  }
  if (url.pathname.indexOf('/Playlists/') === 0 && url.pathname.indexOf('/Items') !== -1) {
    send(response, 200, JSON.stringify({ Items: [{ Id: 'jf-track', Name: 'Carol' }] }));
    return;
  }
  if (url.pathname.indexOf('/Audio/') === 0) {
    send(response, 200, tone, 'audio/wav');
    return;
  }
  serveFile(response, url.pathname);
});

server.listen(port, '127.0.0.1', function () {
  console.log('Alcove preview at http://127.0.0.1:' + port + '/?mock=1');
});
