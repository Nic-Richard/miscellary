import type { CardSetSummary } from '@miscellary/shared';
import styles from './PackStage.module.css';

export default function PackStage({ set }: { set: CardSetSummary }) {
  const image = set.render_pack?.image;

  return (
    <span className={styles.stage}>
      {image ? (
        <img
          className={styles.baked}
          src={image.url}
          alt=""
          width={image.width}
          height={image.height}
          draggable={false}
        />
      ) : null}
    </span>
  );
}
