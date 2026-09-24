import type { ReactNode } from 'react';
import ui from './ui.module.css';
import styles from './PageHeader.module.css';

export default function PageHeader({
  title,
  context,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  context?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string | undefined;
}) {
  return (
    <header className={`${styles.header} ${className ?? ''}`}>
      <div className={styles.text}>
        {context ? <p className={ui.eyebrow}>{context}</p> : null}
        <h1 className={ui.title}>{title}</h1>
        {description ? <p className={ui.subtitle}>{description}</p> : null}
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </header>
  );
}
