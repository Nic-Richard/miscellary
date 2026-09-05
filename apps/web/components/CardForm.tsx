'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  DESCRIPTION_MAX_LENGTH,
  RARITIES,
  RARITY_LABELS,
  validateDescription,
} from '@miscellary/shared';
import type { Card, CardTemplate, ImageRef, Rarity, TemplateConfig } from '@miscellary/shared';
import CardPreview from './CardPreview';
import ImagePicker from './ImagePicker';
import { ChoiceMenu, ColourMenu, Field, Section, Segmented } from './controls';
import { FONT_LABELS } from '@/lib/fonts';
import ui from './ui.module.css';
import { ApiRequestError } from '@/lib/api';
import { createCard, updateCard } from '@/lib/sets';
import styles from './CardForm.module.css';

interface CardFormProps {
  setId: string;
  mark?: string | undefined;
  templates: CardTemplate[];
  card: Card | null;
  onDone: () => Promise<void>;
  onCancel: () => void;
}

const TEXT_KEYS = new Set(['fieldnote', 'dossier']);
const TEMPLATE_GROUPS = [
  { label: 'Photo first', match: (key: string) => !TEXT_KEYS.has(key) },
  { label: 'With a description', match: (key: string) => TEXT_KEYS.has(key) },
];

const ISSUE_TEXT: Record<string, string> = {
  too_long: `Keep it under ${DESCRIPTION_MAX_LENGTH} characters.`,
  heading: 'Headings are not allowed.',
  link: 'Links and images are not allowed.',
  html: 'HTML is not allowed.',
  code: 'Code formatting is not allowed.',
};

function defaults(template: CardTemplate): TemplateConfig {
  const out: TemplateConfig = {};
  for (const [k, opt] of Object.entries(template.options)) out[k] = opt.default;
  return out;
}

export default function CardForm({
  setId,
  mark,
  templates,
  card,
  onDone,
  onCancel,
}: CardFormProps) {
  const firstTemplate = templates[0];
  const [image, setImage] = useState<ImageRef | null>(card?.image ?? null);
  const [title, setTitle] = useState(card?.title ?? '');
  const [rarity, setRarity] = useState<Rarity>(card?.rarity ?? 'common');
  const [description, setDescription] = useState(card?.description ?? '');
  const [templateKey, setTemplateKey] = useState(
    card?.template_key ?? firstTemplate?.key ?? 'classic',
  );
  // Fill absent snapshot options so the controls and preview stay synchronized.
  const [config, setConfig] = useState<TemplateConfig>(() => {
    const start = card ? templates.find((t) => t.key === card.template_key) : firstTemplate;
    return { ...(start ? defaults(start) : {}), ...(card?.template_config ?? {}) };
  });
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);

  const template = templates.find((t) => t.key === templateKey);
  const issues = validateDescription(description);

  function pickTemplate(key: string) {
    const next = templates.find((t) => t.key === key);
    if (!next) return;
    setTemplateKey(key);
    setConfig(defaults(next));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!image) {
      setError('Add a photo first.');
      return;
    }
    setBusy(true);
    setError(null);
    setFields({});
    const body = {
      image_id: image.id,
      title,
      rarity,
      description,
      template_key: templateKey,
      template_config: config,
    };
    try {
      if (card) await updateCard(setId, card.id, body);
      else await createCard(setId, body);
      await onDone();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
        setFields(err.fields);
      } else setError('Could not save the card.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={`${ui.panel} ${styles.root}`} onSubmit={onSubmit}>
      <div className={styles.fields}>
        <h3 className={styles.h3}>{card ? 'Edit card' : 'New card'}</h3>
        {error ? <p className={styles.error}>{error}</p> : null}

        <label className={ui.label}>Photo</label>
        <ImagePicker kind="card" aspect={4 / 5} value={image} onChange={setImage} />
        {fields.image_id?.map((m) => (
          <p key={m} className={styles.error}>
            {m}
          </p>
        ))}

        <label className={ui.label} htmlFor="card-title">
          Title
        </label>
        <input
          id="card-title"
          className={ui.input}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={60}
          required
        />

        <label className={ui.label} htmlFor="card-rarity">
          Rarity
        </label>
        <select
          id="card-rarity"
          className={ui.input}
          value={rarity}
          onChange={(e) => setRarity(e.target.value as Rarity)}
        >
          {RARITIES.map((r) => (
            <option key={r} value={r}>
              {RARITY_LABELS[r]}
            </option>
          ))}
        </select>

        <label className={ui.label} htmlFor="card-desc">
          Description <span className={styles.hint}>**bold**, *italic*, - bullets</span>
        </label>
        <textarea
          id="card-desc"
          className={ui.input}
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        {issues.map((i) => (
          <p key={i} className={styles.error}>
            {ISSUE_TEXT[i]}
          </p>
        ))}
        {fields.description?.map((m) => (
          <p key={m} className={styles.error}>
            {m}
          </p>
        ))}

        <span className={ui.label}>Template</span>
        {TEMPLATE_GROUPS.map((group) => {
          const inGroup = templates.filter((t) => group.match(t.key));
          if (inGroup.length === 0) return null;
          return (
            <div key={group.label} className={styles.templateGroup}>
              <span className={styles.groupLabel}>{group.label}</span>
              <div className={styles.templates}>
                {inGroup.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    aria-pressed={t.key === templateKey}
                    className={`${styles.templateBtn} ${t.key === templateKey ? styles.templateActive : ''}`}
                    onClick={() => pickTemplate(t.key)}
                  >
                    <strong>{t.name}</strong>
                    <small>{t.description}</small>
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        {template && Object.keys(template.options).length > 0 ? (
          <Section title="Look" note="Every option applies to this card alone.">
            {Object.entries(template.options).map(([name, opt]) => {
              const value = config[name] ?? opt.default;
              const set = (v: string) => setConfig({ ...config, [name]: v });
              return (
                <Field key={name} label={opt.label}>
                  {opt.type === 'swatch' ? (
                    <ColourMenu
                      value={value}
                      values={opt.values}
                      palette={name === 'frame' ? 'stock' : 'ink'}
                      onChange={set}
                    />
                  ) : opt.type === 'font' ? (
                    <ChoiceMenu
                      value={value}
                      values={opt.values}
                      labels={FONT_LABELS}
                      onChange={set}
                    />
                  ) : opt.values.length <= 3 ? (
                    <Segmented value={value} values={opt.values} onChange={set} />
                  ) : (
                    <ChoiceMenu value={value} values={opt.values} onChange={set} />
                  )}
                </Field>
              );
            })}
          </Section>
        ) : null}

        <div className={styles.actions}>
          <button className={ui.btnPrimary} type="submit" disabled={busy || issues.length > 0}>
            {busy ? 'Saving…' : card ? 'Save card' : 'Add card'}
          </button>
          <button className={ui.btnQuiet} type="button" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        </div>
      </div>

      <div className={styles.preview}>
        <CardPreview
          title={title}
          rarity={rarity}
          description={description}
          imageUrl={image?.url ?? null}
          templateKey={templateKey}
          templateConfig={config}
          mark={mark}
        />
        <span className={styles.previewLabel}>Live card preview</span>
      </div>
    </form>
  );
}
