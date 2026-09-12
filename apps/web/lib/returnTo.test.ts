import { describe, expect, it } from 'vitest';
import { internalPath, loginHref, registerHref, returnPath, swapAuthHref } from './returnTo';

describe('internalPath', () => {
  it('keeps a path inside this app', () => {
    expect(internalPath('/sets/pocket-geology?do=pack')).toBe('/sets/pocket-geology?do=pack');
    expect(internalPath('/collection#top')).toBe('/collection#top');
  });

  it('refuses anything that could leave the origin', () => {
    for (const value of [
      'https://evil.example/steal',
      '//evil.example/steal',
      '/\\evil.example',
      'javascript:alert(1)',
      '/ /evil.example',
      '\t/evil.example',
      '',
      null,
      undefined,
    ]) {
      expect(internalPath(value), String(value)).toBeNull();
    }
  });

  it('refuses a sign-in page, which would loop', () => {
    expect(internalPath('/login?next=%2Faccount')).toBeNull();
    expect(internalPath('/register')).toBeNull();
  });
});

describe('loginHref', () => {
  it('carries the destination and the action it should finish', () => {
    expect(loginHref('/sets/abc', 'pack')).toBe('/login?next=%2Fsets%2Fabc%3Fdo%3Dpack');
    expect(loginHref('/collection')).toBe('/login?next=%2Fcollection');
    expect(registerHref('/collection')).toBe('/register?next=%2Fcollection');
    expect(registerHref('/login')).toBe('/register');
    expect(loginHref('/register')).toBe('/login');
  });

  it('drops a destination it would not follow', () => {
    expect(loginHref('https://evil.example')).toBe('/login');
  });
});

describe('returnPath', () => {
  it('reads a safe destination and falls back otherwise', () => {
    expect(returnPath(new URLSearchParams('next=%2Fsets%2Fabc'))).toBe('/sets/abc');
    expect(returnPath(new URLSearchParams('next=https%3A%2F%2Fevil.example'))).toBe('/account');
    expect(returnPath(new URLSearchParams(''))).toBe('/account');
  });
});

describe('swapAuthHref', () => {
  it('moves between the two forms without losing the destination', () => {
    expect(swapAuthHref('/register', new URLSearchParams('next=%2Fsets%2Fabc'))).toBe(
      '/register?next=%2Fsets%2Fabc',
    );
    expect(swapAuthHref('/login', new URLSearchParams(''))).toBe('/login');
  });
});
