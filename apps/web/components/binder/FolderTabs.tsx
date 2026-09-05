import Link from 'next/link';
import styles from './FolderTabs.module.css';

export interface Tab {
  label: string;
  href?: string | undefined;
  onSelect?: (() => void) | undefined;
  icon?: 'overview' | 'cards' | 'binders' | 'about';
  count?: string | number;
  active?: boolean;
}

const ICONS = {
  overview: 'M4 6h16v12H4ZM4 10h16M9 10v8',
  cards: 'M7 4h10v16H7ZM4 7h1v10H4Zm15 0h1v10h-1ZM10 8h4M10 11h4',
  binders: 'M4 5.5h6a2 2 0 0 1 2 2V19a2 2 0 0 0-2-2H4Zm16 0h-6a2 2 0 0 0-2 2V19a2 2 0 0 1 2-2h6Z',
  about: 'M5 4h9l5 5v11H5Zm9 0v5h5M8 13h8M8 16h6',
};

export default function FolderTabs({ tabs, label }: { tabs: Tab[]; label: string }) {
  return (
    <nav className={styles.tabs} aria-label={label}>
      {tabs.map((t) => {
        const className = `${styles.tab} ${t.active ? styles.active : ''}`;
        const body = (
          <>
            {t.icon ? (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d={ICONS[t.icon]} />
              </svg>
            ) : null}
            <span>{t.label}</span>
            {t.count !== undefined ? <b>{t.count}</b> : null}
          </>
        );
        if (!t.href) {
          return (
            <button
              key={t.label}
              type="button"
              className={className}
              aria-current={t.active ? 'page' : undefined}
              onClick={t.onSelect}
            >
              {body}
            </button>
          );
        }
        return t.href.startsWith('#') ? (
          <a
            key={t.label}
            href={t.href}
            className={className}
            aria-current={t.active ? 'page' : undefined}
          >
            {body}
          </a>
        ) : (
          <Link key={t.label} href={t.href} className={className}>
            {body}
          </Link>
        );
      })}
    </nav>
  );
}
