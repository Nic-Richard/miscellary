import type { InputHTMLAttributes } from 'react';
import PasswordInput from './PasswordInput';
import styles from './AuthForm.module.css';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  errors?: string[] | undefined;
}

export default function Field({ label, errors, id, type, ...rest }: FieldProps) {
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {type === 'password' ? (
        <PasswordInput id={id} className={styles.input} {...rest} />
      ) : (
        <input id={id} className={styles.input} type={type} {...rest} />
      )}
      {errors?.map((e) => (
        <span key={e} className={styles.fieldError}>
          {e}
        </span>
      ))}
    </div>
  );
}
