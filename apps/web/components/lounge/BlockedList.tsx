'use client';

import BlockedPeople from '@/components/BlockedPeople';
import ui from '@/components/ui.module.css';
import styles from './Lounge.module.css';

export default function BlockedList({
  onClose,
  onChange,
}: {
  onClose: () => void;
  onChange: () => void;
}) {
  return (
    <div className={styles.paneScroll}>
      <div className={styles.form}>
        <button type="button" className={styles.back} onClick={onClose}>
          <span aria-hidden="true">←</span> All discussions
        </button>
        <h2>Blocked collectors</h2>
        <BlockedPeople onChange={onChange} />
        <div className={styles.formActions}>
          <button type="button" className={ui.btnQuiet} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
