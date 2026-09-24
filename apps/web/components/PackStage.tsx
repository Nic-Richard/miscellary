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
      ) : (
        // Drafts and packs still baking have no render yet; a plain wrapper stands in.
        <span className={styles.blank}>
          <img src="/materials/pack-blank.png" alt="" draggable={false} />
          <span className={styles.blankTitle}>{set.title}</span>
        </span>
      )}
    </span>
  );
}
