import type { InputHTMLAttributes } from 'react';
import styles from './AuthForm.module.css';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  errors?: string[] | undefined;
}

export default function Field({ label, errors, id, ...rest }: FieldProps) {
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <input id={id} className={styles.input} {...rest} />
      {errors?.map((e) => (
        <span key={e} className={styles.fieldError}>
          {e}
        </span>
      ))}
    </div>
  );
}
