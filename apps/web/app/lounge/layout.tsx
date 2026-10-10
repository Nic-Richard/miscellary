import type { ReactNode } from 'react';
import LoungeShell from '@/components/lounge/LoungeShell';

export default function LoungeLayout({ children }: { children: ReactNode }) {
  return <LoungeShell>{children}</LoungeShell>;
}
