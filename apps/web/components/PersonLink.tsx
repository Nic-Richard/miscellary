import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Creator } from '@miscellary/shared';

export default function PersonLink({
  person,
  className,
  children,
}: {
  person: Pick<Creator, 'username' | 'deleted'>;
  className?: string | undefined;
  children: ReactNode;
}) {
  if (person.deleted) return <span className={className}>{children}</span>;
  return (
    <Link href={`/users/${person.username}`} className={className}>
      {children}
    </Link>
  );
}
