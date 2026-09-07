import assert from 'node:assert/strict';
import { test } from 'node:test';
import { localMediaUrl, resolveApiUrl } from '../lib/connection.ts';

test('development resolves the Metro host for a phone or emulator', () => {
  assert.equal(resolveApiUrl('', '10.0.0.84:8081', true), 'http://10.0.0.84:8000');
  assert.equal(resolveApiUrl(undefined, '10.0.2.2:8081', true), 'http://10.0.2.2:8000');
  assert.equal(resolveApiUrl(undefined, undefined, true), 'http://10.0.2.2:8000');
  assert.equal(
    resolveApiUrl('https://api.example.com/', undefined, false),
    'https://api.example.com',
  );
  assert.throws(() => resolveApiUrl('', undefined, false), /EXPO_PUBLIC_API_URL/);
});

test('development rewrites only loopback media hosts', () => {
  const api = 'http://10.0.0.84:8000';
  assert.equal(
    localMediaUrl('url', 'http://localhost:9000/media/photo.jpg', api, true),
    'http://10.0.0.84:9000/media/photo.jpg',
  );
  assert.equal(
    localMediaUrl('avatar_url', 'http://127.0.0.1:9000/avatar.jpg', api, true),
    'http://10.0.0.84:9000/avatar.jpg',
  );
  for (const value of [
    'https://cdn.example.com/photo.jpg',
    'http://localhost.example.com/photo.jpg',
    '/photo.jpg',
    null,
  ]) {
    assert.equal(localMediaUrl('url', value, api, true), value);
  }
});

test('production, authored text, and signed upload URLs are untouched', () => {
  const url = 'http://localhost:9000/media/photo.jpg?X-Amz-Signature=signature';
  assert.equal(localMediaUrl('url', url, 'https://api.example.com', false), url);
  assert.equal(localMediaUrl('upload_url', url, 'http://10.0.0.84:8000', true), url);
  assert.equal(localMediaUrl('description', url, 'http://10.0.0.84:8000', true), url);
});
