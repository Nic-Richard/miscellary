import type { CardSetSummary } from '@miscellary/shared';
import { binderSwatchStyle } from '@/lib/setIdentity';
import PackPouch from './PackPouch';
import styles from './PackStage.module.css';

export default function PackStage({ set }: { set: CardSetSummary }) {
  return (
    <span className={styles.stage}>
      <span
        className={styles.ground}
        style={binderSwatchStyle(set.binder_colour || 'teal')}
        aria-hidden="true"
      />
      <span className={styles.pack}>
        <PackPouch title={set.title} identity={set} />
      </span>
    </span>
  );
}
