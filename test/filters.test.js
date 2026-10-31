const test = require('node:test');
const assert = require('node:assert/strict');
const { loadAlcove } = require('./helpers');

const Alcove = loadAlcove(['util.js', 'settings.js', 'library.js', 'filters.js']);

function photo(extra) {
  return Object.assign({
    id: 'x',
    type: 'IMAGE',
    visibility: 'timeline',
    originalFileName: 'photo.jpg',
    originalPath: '/photos/photo.jpg',
    width: 4000,
    height: 3000,
    rating: 5,
    people: [{ id: 'p', name: 'Ada' }],
    tags: []
  }, extra);
}

test('filters drop archived, hidden, trashed, screenshots, small files, low ratings, and tags', function () {
  const settings = Alcove.mergeSettings({
    filters: {
      peopleOnly: true,
      minRating: 3,
      excludeTag: 'blurry',
      minShortEdge: 720
    }
  });
  const kept = Alcove.filters.apply([
    photo({ id: 'shot', originalFileName: 'Screenshot_1.png' }),
    photo({ id: 'small', width: 400, height: 300 }),
    photo({ id: 'blur', rating: 2, tags: [{ name: 'blurry', value: 'quality/blurry' }] }),
    photo({ id: 'archived', isArchived: true, visibility: 'archive' }),
    photo({ id: 'hidden', visibility: 'hidden' }),
    photo({ id: 'trash', isTrashed: true }),
    photo({ id: 'video', type: 'VIDEO' }),
    photo({ id: 'noface', people: [] }),
    photo({ id: 'unknown', people: null }),
    photo({ id: 'good' })
  ], settings, { good: true });
  assert.equal(kept.map(function (asset) { return asset.id; }).join(','), 'unknown');
});
