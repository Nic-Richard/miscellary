import Link from 'next/link';
import type { ReactNode } from 'react';
import styles from './SectionHeader.module.css';

export default function SectionHeader({
  title,
  note,
  link,
}: {
  title: ReactNode;
  note?: ReactNode;
  link?: { href: string; label: string } | undefined;
}) {
  return (
    <div className={styles.head}>
      <div>
        <h2 className={styles.title}>{title}</h2>
        {note ? <p className={styles.note}>{note}</p> : null}
      </div>
      {link ? (
        <Link href={link.href} className={styles.link}>
          {link.label} →
        </Link>
      ) : null}
    </div>
  );
}
