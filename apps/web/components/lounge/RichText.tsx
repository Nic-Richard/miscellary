import Link from 'next/link';
import { Fragment } from 'react';
import styles from './Lounge.module.css';

const MENTION = /(?<![\w@])(@[a-z0-9_]{3,20})\b/gi;

export default function RichText({
  text,
  className,
}: {
  text: string;
  className?: string | undefined;
}) {
  const parts = text.split(MENTION);
  return (
    <p className={className}>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <Link
            key={index}
            href={`/users/${part.slice(1).toLowerCase()}`}
            className={styles.mention}
          >
            {part}
          </Link>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </p>
  );
}
