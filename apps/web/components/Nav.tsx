'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '@/lib/auth';
import { loginHref, registerHref, swapAuthHref } from '@/lib/returnTo';
import BrandMark from './BrandMark';
import styles from './Nav.module.css';

type IconName = 'home' | 'binders' | 'cards' | 'trades' | 'studio' | 'profile' | 'search' | 'plus';

const ICONS: Record<IconName, string> = {
  home: 'M4 11.5 12 4.5l8 7V20h-5.5v-5h-5v5H4Z',
  binders:
    'M4 5.5h6a2 2 0 0 1 2 2V19a2 2 0 0 0-2-2H4Zm16 0h-6a2 2 0 0 0-2 2V19a2 2 0 0 1 2-2h6ZM12 7.5V19',
  cards: 'M7 4h10v16H7Zm-3 3h1v10H4Zm15 0h1v10h-1ZM10 8h4M10 11h4',
  trades: 'M4 8h13l-3-3M20 16H7l3 3',
  studio: 'M5 19 6 14 16 4l4 4L10 18ZM14 6l4 4',
  profile: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9c0-4 3-6.5 7-6.5s7 2.5 7 6.5',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm5-2 4 4',
  plus: 'M12 5v14M5 12h14',
};

export function NavIcon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

export default function Nav() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState('');

  function onSearch(e: FormEvent) {
    e.preventDefault();
    if (q.trim().length >= 2) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
  }

  const gated = (href: string) => (user ? href : registerHref(href));
  const profileHref = user ? `/users/${user.profile.username}` : registerHref('/account');

  const links: { href: string; label: string; icon: IconName; match: string }[] = [
    { href: '/', label: 'Home', icon: 'home', match: '/' },
    { href: '/sets', label: 'Sets', icon: 'binders', match: '/sets' },
    { href: gated('/collection'), label: 'My cards', icon: 'cards', match: '/collection' },
    { href: gated('/trades'), label: 'Trades', icon: 'trades', match: '/trades' },
    { href: gated('/studio'), label: 'Studio', icon: 'studio', match: '/studio' },
    { href: profileHref, label: 'Profile', icon: 'profile', match: '/users' },
  ];

  function isActive(match: string) {
    if (match === '/') return pathname === '/';
    return pathname === match || pathname.startsWith(`${match}/`);
  }

  return (
    <header className={styles.root}>
      <Link href="/" className={styles.brand}>
        <BrandMark className={styles.brandMark} />
        <span className={styles.wordmark}>Miscellary</span>
        <small>Collect · Trade · Create</small>
      </Link>

      <nav className={styles.links} aria-label="Main">
        {links.map((l) => (
          <Link
            key={l.label}
            href={l.href}
            className={isActive(l.match) ? styles.active : undefined}
            aria-current={isActive(l.match) ? 'page' : undefined}
          >
            <NavIcon name={l.icon} />
            {l.label}
          </Link>
        ))}
      </nav>

      <div className={styles.foot}>
        <form className={styles.search} onSubmit={onSearch} role="search">
          <NavIcon name="search" />
          <input
            className={styles.searchInput}
            placeholder="Search"
            aria-label="Search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </form>

        <Link href={user ? '/studio' : '/register'} className={styles.newBtn}>
          <NavIcon name="plus" />
          New
        </Link>

        <div className={styles.account}>
          {loading ? null : user ? (
            <>
              <Link href={profileHref} className={styles.profileLink}>
                @{user.profile.username}
              </Link>
              <button type="button" className={styles.linkBtn} onClick={() => void logout()}>
                Log out
              </button>
            </>
          ) : (
            <>
              <Suspense fallback={<AuthLinks pathname={pathname} />}>
                <AuthLinksCarryingQuery pathname={pathname} />
              </Suspense>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function AuthLinks({
  pathname,
  to,
}: {
  pathname: string;
  to?: { login: string; register: string };
}) {
  return (
    <>
      <Link href={to?.login ?? loginHref(pathname)} className={styles.secondary}>
        Log in
      </Link>
      <Link href={to?.register ?? registerHref(pathname)} className={styles.primary}>
        Sign up
      </Link>
    </>
  );
}

function AuthLinksCarryingQuery({ pathname }: { pathname: string }) {
  const search = useSearchParams();
  if (pathname !== '/login' && pathname !== '/register') return <AuthLinks pathname={pathname} />;
  return (
    <AuthLinks
      pathname={pathname}
      to={{ login: swapAuthHref('/login', search), register: swapAuthHref('/register', search) }}
    />
  );
}
