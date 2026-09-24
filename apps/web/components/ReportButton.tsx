'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import ReportDialog from './ReportDialog';
import type { ReportTarget } from './ReportDialog';

export default function ReportButton({
  target,
  subject,
  className,
}: {
  target: ReportTarget;
  subject: string;
  className?: string | undefined;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        Report
      </button>
      {open ? (
        <ReportDialog target={target} subject={subject} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}
