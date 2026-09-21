import type { CardSetSummary } from '@miscellary/shared';
import { binderSwatchStyle } from '@/lib/setIdentity';
import PackPouch from './PackPouch';
import styles from './PackStage.module.css';

export default function PackStage({ set }: { set: CardSetSummary }) {
  const baked = set.render_pack?.image;

  return (
    <span className={styles.stage}>
      <span
        className={styles.ground}
        style={binderSwatchStyle(set.binder_colour || 'teal')}
        aria-hidden="true"
      />
      <span className={styles.pack}>
        {baked ? (
          <img
            className={styles.baked}
            src={baked.url}
            alt=""
            width={baked.width}
            height={baked.height}
            draggable={false}
          />
        ) : (
          <PackPouch title={set.title} identity={set} />
        )}
      </span>
    </span>
  );
}
