import type { InputHTMLAttributes } from 'react';
import PasswordInput from './PasswordInput';
import styles from './AuthForm.module.css';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  errors?: string[] | undefined;
  hint?: string;
}

export default function Field({ label, errors, hint, id, type, ...rest }: FieldProps) {
  const described = hint ? `${id}-hint` : undefined;
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {type === 'password' ? (
        <PasswordInput id={id} className={styles.input} aria-describedby={described} {...rest} />
      ) : (
        <input
          id={id}
          className={styles.input}
          type={type}
          aria-describedby={described}
          {...rest}
        />
      )}
      {hint ? (
        <span id={described} className={styles.hint}>
          {hint}
        </span>
      ) : null}
      {errors?.map((e) => (
        <span key={e} className={styles.fieldError}>
          {e}
        </span>
      ))}
    </div>
  );
}
