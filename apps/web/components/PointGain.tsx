import styles from './PointGain.module.css';

export default function PointGain({ amount }: { amount: number }) {
  return (
    <span className={styles.gain} role="status" aria-label={`Earned ${amount} points`}>
      +{amount}
    </span>
  );
}
