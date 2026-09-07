import type { AnchorHTMLAttributes } from 'react';
import { send } from './bridge';
export default function Link({
  href,
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      {...props}
      href={href}
      onClick={(event) => {
        event.preventDefault();
        send('navigate', href);
      }}
    >
      {children}
    </a>
  );
}
