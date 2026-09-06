'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  DESCRIPTION_MAX_LENGTH,
  OPTION_GROUPS,
  RARITIES,
  RARITY_LABELS,
  validateDescription,
} from '@miscellary/shared';
import type {
  Card,
  CardTemplate,
  ImageRef,
  OptionGroup,
  Rarity,
  TemplateConfig,
  TemplateOption,
} from '@miscellary/shared';
import CardPreview from './CardPreview';
import ImagePicker from './ImagePicker';
import { ChoiceMenu, ColourMenu, Field, Section, Segmented, TileGrid } from './controls';
import { FONT_LABELS } from '@/lib/fonts';
import { coatTile, textureTile } from '@/lib/palette';
import { GROUP_LABELS, GROUP_NOTES, valueLabel, valueLabels } from '@/lib/templateLabels';
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

function reached(needed: Rarity | undefined, rarity: Rarity): boolean {
  return !needed || RARITIES.indexOf(rarity) >= RARITIES.indexOf(needed);
}

/** Values this tier cannot print yet, mapped to the tier that opens them. */
function locksFor(opt: TemplateOption, rarity: Rarity): Record<string, string> {
  const out: Record<string, string> = {};
  for (const v of opt.values) {
    const needed = opt.unlocks?.[v];
    if (needed && !reached(needed, rarity)) out[v] = RARITY_LABELS[needed];
  }
  return out;
}

/** What each tier adds on top of the one below it, for this template. */
function ladder(template: CardTemplate | undefined): Map<Rarity, string[]> {
  const byTier = new Map<Rarity, string[]>();
  const add = (tier: Rarity, what: string) => byTier.set(tier, [...(byTier.get(tier) ?? []), what]);
  if (template?.unlocks) add(template.unlocks, `the ${template.name} template`);
  for (const [name, opt] of Object.entries(template?.options ?? {})) {
    for (const v of opt.values) {
      const needed = opt.unlocks?.[v];
      if (needed) add(needed, valueLabel(name, v).toLowerCase());
    }
  }
  return byTier;
}

/** Bring a config back inside what a rarity may print, and say what moved. */
function settle(
  template: CardTemplate,
  config: TemplateConfig,
  rarity: Rarity,
): { config: TemplateConfig; moved: string[] } {
  const next: TemplateConfig = { ...config };
  const moved: string[] = [];
  for (const [name, opt] of Object.entries(template.options)) {
    const value = next[name] ?? opt.default;
    if (!reached(opt.unlocks?.[value], rarity)) {
      next[name] = opt.default;
      moved.push(valueLabel(name, value).toLowerCase());
    }
  }
  // A legendary card must carry a chase, and nothing below it may.
  const chase = next.treatment ?? 'none';
  if (rarity === 'legendary' && chase === 'none') next.treatment = 'foil';
  return { config: next, moved };
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
  const [config, setConfig] = useState<TemplateConfig>(() => {
    const start = card ? templates.find((t) => t.key === card.template_key) : firstTemplate;
    return { ...(start ? defaults(start) : {}), ...(card?.template_config ?? {}) };
  });
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);

  const template = templates.find((t) => t.key === templateKey);
  const issues = validateDescription(description);
  const opens = ladder(template);
  const nextTier = RARITIES.find((t) => opens.has(t) && !reached(t, rarity));

  function pickTemplate(key: string) {
    const next = templates.find((t) => t.key === key);
    if (!next) return;
    setTemplateKey(key);
    setConfig(settle(next, defaults(next), rarity).config);
    setNote(null);
  }

  // Keep existing config valid when rarity changes.
  function pickRarity(next: Rarity) {
    setRarity(next);
    if (!template) return;
    const said: string[] = [];
    let chosen = template;
    let base = config;
    if (!reached(chosen.unlocks, next)) {
      const open = templates.find((t) => reached(t.unlocks, next));
      if (!open) return;
      said.push(
        `${chosen.name} needs ${RARITY_LABELS[chosen.unlocks!]}, so this is now ${open.name}`,
      );
      chosen = open;
      base = defaults(open);
      setTemplateKey(open.key);
    }
    const { config: fixed, moved } = settle(chosen, base, next);
    setConfig(fixed);
    if (moved.length) said.push(`${moved.join(', ')} moved back to the standard choice`);
    setNote(said.length ? `${RARITY_LABELS[next]}: ${said.join('; ')}.` : null);
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

  function control(name: string, opt: TemplateOption) {
    const value = config[name] ?? opt.default;
    const set = (v: string) => setConfig({ ...config, [name]: v });
    // Legendary cards cannot be saved without a chase treatment.
    const values =
      name === 'treatment' && rarity === 'legendary'
        ? opt.values.filter((v) => v !== 'none')
        : opt.values;
    const locks = locksFor(opt, rarity);
    const labels = opt.type === 'font' ? FONT_LABELS : valueLabels(name, values);

    if (name === 'texture' || name === 'finish') {
      const tileFor = name === 'texture' ? textureTile : coatTile;
      return (
        <TileGrid
          value={value}
          values={values}
          labels={labels}
          locks={locks}
          tileFor={tileFor}
          onChange={set}
        />
      );
    }
    if (opt.type === 'swatch') {
      return (
        <ColourMenu
          value={value}
          values={values}
          labels={labels}
          locks={locks}
          palette={name === 'frame' ? 'stock' : 'ink'}
          onChange={set}
        />
      );
    }
    const inline =
      Object.keys(locks).length === 0 &&
      values.length <= 3 &&
      values.every((v) => (labels[v] ?? v).length <= 9);
    if (inline) {
      return <Segmented value={value} values={values} labels={labels} onChange={set} />;
    }
    return (
      <ChoiceMenu value={value} values={values} labels={labels} locks={locks} onChange={set} />
    );
  }

  function group(name: OptionGroup) {
    const options = Object.entries(template?.options ?? {}).filter(
      ([, opt]) => (opt.group ?? 'board') === name,
    );
    const shown = options.filter(
      ([key]) => key !== 'coverage' || (config.treatment ?? 'none') !== 'none',
    );
    if (shown.length === 0) return null;
    return (
      <Section key={name} title={GROUP_LABELS[name]} note={GROUP_NOTES[name]}>
        {shown.map(([key, opt]) => (
          <Field key={key} label={opt.label}>
            {control(key, opt)}
          </Field>
        ))}
      </Section>
    );
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

        <span className={ui.label}>Rarity</span>
        <div className={styles.tiers} role="group" aria-label="Rarity">
          {RARITIES.map((r) => (
            <button
              key={r}
              type="button"
              data-rarity={r}
              aria-pressed={r === rarity}
              className={`${styles.tier} ${r === rarity ? styles.tierOn : ''}`}
              onClick={() => pickRarity(r)}
            >
              {RARITY_LABELS[r]}
            </button>
          ))}
        </div>
        <p className={styles.tierNote}>
          {rarity === 'legendary'
            ? 'A legendary card is struck with a foil or holographic chase.'
            : nextTier
              ? `${RARITY_LABELS[nextTier]} adds ${opens.get(nextTier)!.join(', ')}.`
              : 'Every option on this template is open at this tier.'}
        </p>
        {note ? <p className={styles.note}>{note}</p> : null}

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
        {fields.template_key?.map((m) => (
          <p key={m} className={styles.error}>
            {m}
          </p>
        ))}
        {TEMPLATE_GROUPS.map((tgroup) => {
          const inGroup = templates.filter((t) => tgroup.match(t.key));
          if (inGroup.length === 0) return null;
          return (
            <div key={tgroup.label} className={styles.templateGroup}>
              <span className={styles.groupLabel}>{tgroup.label}</span>
              <div className={styles.templates}>
                {inGroup.map((t) => {
                  const shut = !reached(t.unlocks, rarity);
                  return (
                    <button
                      key={t.key}
                      type="button"
                      aria-pressed={t.key === templateKey}
                      disabled={shut}
                      className={`${styles.templateBtn} ${t.key === templateKey ? styles.templateActive : ''}`}
                      onClick={() => pickTemplate(t.key)}
                    >
                      <strong>
                        {t.name}
                        {shut ? (
                          <span className={styles.lockTag}>{RARITY_LABELS[t.unlocks!]}</span>
                        ) : null}
                      </strong>
                      <small>{t.description}</small>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className={styles.groups}>{OPTION_GROUPS.map(group)}</div>
        {fields.template_config?.map((m) => (
          <p key={m} className={styles.error}>
            {m}
          </p>
        ))}

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
        <div className={styles.proof}>
          <CardPreview
            title={title}
            rarity={rarity}
            description={description}
            imageUrl={image?.url ?? null}
            templateKey={templateKey}
            templateConfig={config}
            mark={mark}
          />
        </div>
      </div>
    </form>
  );
}
