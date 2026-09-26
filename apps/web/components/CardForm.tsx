'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  DESCRIPTION_MAX_LENGTH,
  OPTION_GROUPS,
  RARITIES,
  RARITY_LABELS,
  validateDescription,
  prepareCardDesign,
  licenceOf,
  photoFrame,
  photoFrameKeys,
  PHOTO_LICENCES,
  PHOTO_ZOOM_MAX,
  withPhotoFrame,
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
import { borderTile, coatTile, shapeTile, textureTile } from '@/lib/palette';
import MarkupBar from './MarkupBar';
import RichTextArea from './RichTextArea';
import TemplateThumb from './TemplateThumb';
import TiltStage from './TiltStage';
import { GROUP_LABELS, GROUP_NOTES, valueLabel, valueLabels } from '@/lib/templateLabels';
import ui from './ui.module.css';
import { ApiRequestError } from '@/lib/api';
import { createCard, updateCard } from '@/lib/sets';
import { savePhotoCredit } from '@/lib/upload';
import styles from './CardForm.module.css';

interface CardFormProps {
  setId: string;
  mark?: string | undefined;
  code?: string;
  templates: CardTemplate[];
  card: Card | null;
  design?: Card | null;
  onDone: () => Promise<void>;
  onCancel: () => void;
}

const OPTION_TILES: Record<string, typeof textureTile> = {
  texture: textureTile,
  finish: coatTile,
  shape: shapeTile,
  weight: borderTile,
};
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

function locksFor(opt: TemplateOption, rarity: Rarity): Record<string, string> {
  const out: Record<string, string> = {};
  for (const v of opt.values) {
    const needed = opt.unlocks?.[v];
    if (needed && !reached(needed, rarity)) out[v] = RARITY_LABELS[needed];
  }
  return out;
}

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
  return { config: next, moved };
}

function creditDraft(image: ImageRef | null) {
  return {
    licence: licenceOf(image?.credit) as string,
    author: image?.credit?.author ?? '',
    source_url: image?.credit?.source_url ?? '',
  };
}

export default function CardForm({
  setId,
  mark,
  code,
  templates,
  card,
  design = null,
  onDone,
  onCancel,
}: CardFormProps) {
  const firstTemplate = templates[0];
  const [image, setImage] = useState<ImageRef | null>(card?.image ?? null);
  const [title, setTitle] = useState(card?.title ?? '');
  const [rarity, setRarity] = useState<Rarity>(card?.rarity ?? 'common');
  const [description, setDescription] = useState(card?.description ?? '');
  const [printedText, setPrintedText] = useState(card?.printed_text ?? '');
  const source = card ?? design;
  const [templateKey, setTemplateKey] = useState(
    source?.template_key ?? firstTemplate?.key ?? 'classic',
  );
  const [config, setConfig] = useState<TemplateConfig>(() => {
    const start = source ? templates.find((t) => t.key === source.template_key) : firstTemplate;
    const stored = { ...(source?.template_config ?? {}) };
    if (!card) for (const key of Object.keys(photoFrameKeys(stored))) delete stored[key];
    return { ...(start ? defaults(start) : {}), ...stored };
  });
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);

  const template = templates.find((t) => t.key === templateKey);
  const frame = photoFrame(config);
  const setFrame = (next: ReturnType<typeof photoFrame>) =>
    setConfig((current) => withPhotoFrame(current, next));

  const [credit, setCredit] = useState(() => creditDraft(card?.image ?? null));
  const creditChanged =
    image !== null && JSON.stringify(credit) !== JSON.stringify(creditDraft(image));

  function pickImage(next: ImageRef) {
    setImage(next);
    setCredit(creditDraft(next));
    setConfig((current) => {
      const { photo_x: _x, photo_y: _y, photo_zoom: _zoom, ...rest } = current;
      return rest;
    });
  }
  const issues = validateDescription(description);
  const opens = ladder(template);
  const nextTier = RARITIES.find((t) => opens.has(t) && !reached(t, rarity));

  function pickTemplate(key: string) {
    const next = templates.find((t) => t.key === key);
    if (!next) return;
    setTemplateKey(key);
    setConfig({ ...settle(next, defaults(next), rarity).config, ...photoFrameKeys(config) });
    setTitle((value) => value.slice(0, next.text.title.max_length));
    setPrintedText((value) =>
      next.text.printed ? value.slice(0, next.text.printed.max_length) : '',
    );
    setNote(null);
  }

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
      setTitle((value) => value.slice(0, open.text.title.max_length));
      setPrintedText((value) =>
        open.text.printed ? value.slice(0, open.text.printed.max_length) : '',
      );
    }
    const { config: fixed, moved } = settle(chosen, base, next);
    setConfig({ ...fixed, ...photoFrameKeys(config) });
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
    if (creditChanged) {
      try {
        setImage(await savePhotoCredit(image.id, credit));
      } catch (err) {
        if (err instanceof ApiRequestError) setFields(err.fields);
        setError(err instanceof Error ? err.message : 'Could not save the photo credit.');
        setBusy(false);
        return;
      }
    }
    const body = {
      image_id: image.id,
      title,
      rarity,
      description,
      printed_text: printedText,
      template_key: templateKey,
      template_config: prepareCardDesign(templateKey, config),
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
    const values = opt.values;
    const locks = locksFor(opt, rarity);
    const labels = opt.type === 'font' ? FONT_LABELS : valueLabels(name, values);

    const tileFor = OPTION_TILES[name];
    if (tileFor) {
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
        <ColourMenu value={value} values={values} labels={labels} locks={locks} onChange={set} />
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

  function noteFor(name: OptionGroup) {
    const note = GROUP_NOTES[name];
    return note ? { note } : {};
  }

  function group(name: OptionGroup) {
    const options = Object.entries(template?.options ?? {}).filter(
      ([, opt]) => (opt.group ?? 'board') === name,
    );
    const foiled = (config.treatment ?? 'none') !== 'none';
    const shown = options.filter(
      ([key, opt]) =>
        opt.values.length > 1 && (foiled || (key !== 'pattern' && key !== 'coverage')),
    );
    if (shown.length === 0) return null;
    return (
      <Section key={name} title={GROUP_LABELS[name]} {...noteFor(name)}>
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
        <ImagePicker kind="card" value={image} onChange={pickImage} />
        {image ? (
          <div className={styles.framing}>
            <label className={styles.framingLabel} htmlFor="photo-zoom">
              Zoom
            </label>
            <input
              id="photo-zoom"
              type="range"
              min={1}
              max={PHOTO_ZOOM_MAX}
              step={0.01}
              value={frame.zoom}
              onChange={(e) => setFrame({ ...frame, zoom: Number(e.target.value) })}
            />
            <button
              type="button"
              className={ui.link}
              disabled={frame.x === 50 && frame.y === 50 && frame.zoom === 1}
              onClick={() => setFrame({ x: 50, y: 50, zoom: 1 })}
            >
              Center
            </button>
            <p className={styles.framingNote}>Drag the photo on the card to choose what shows.</p>
          </div>
        ) : null}
        {image ? (
          <fieldset className={styles.credit}>
            <legend className={ui.label}>Photo credit</legend>
            <select
              className={ui.input}
              aria-label="Whose photo this is"
              value={credit.licence}
              onChange={(e) => setCredit({ ...credit, licence: e.target.value })}
            >
              {PHOTO_LICENCES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
            {credit.licence === 'own' ? (
              <p className={styles.framingNote}>Your own photos print without a credit line.</p>
            ) : (
              <>
                <input
                  className={ui.input}
                  aria-label="Taken by"
                  placeholder="Taken by"
                  maxLength={120}
                  value={credit.author}
                  onChange={(e) => setCredit({ ...credit, author: e.target.value })}
                />
                {fields.author?.map((m) => (
                  <p key={m} className={styles.error}>
                    {m}
                  </p>
                ))}
                <input
                  className={ui.input}
                  type="url"
                  aria-label="Where it is from"
                  placeholder="Link to where it is from (optional)"
                  maxLength={500}
                  value={credit.source_url}
                  onChange={(e) => setCredit({ ...credit, source_url: e.target.value })}
                />
                {fields.source_url?.map((m) => (
                  <p key={m} className={styles.error}>
                    {m}
                  </p>
                ))}
                <p className={styles.framingNote}>Printed with the card: Photo: name (licence).</p>
              </>
            )}
          </fieldset>
        ) : null}
        {fields.image_id?.map((m) => (
          <p key={m} className={styles.error}>
            {m}
          </p>
        ))}

        {fields.title?.map((m) => (
          <p key={m} className={styles.error}>
            {m}
          </p>
        ))}

        <label className={ui.label} htmlFor="card-desc">
          Longer description <span className={styles.hint}>not printed on the card</span>
        </label>
        <MarkupBar />
        <RichTextArea
          id="card-desc"
          className={ui.input}
          label="Longer description"
          rows={4}
          value={description}
          onChange={setDescription}
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
        {nextTier ? (
          <p className={styles.tierNote}>
            {RARITY_LABELS[nextTier]} adds {opens.get(nextTier)!.join(', ')}.
          </p>
        ) : null}
        {note ? <p className={styles.note}>{note}</p> : null}

        <span className={ui.label}>Template</span>
        {fields.template_key?.map((m) => (
          <p key={m} className={styles.error}>
            {m}
          </p>
        ))}
        <div className={styles.templates}>
          {templates.map((t) => {
            const shut = !reached(t.unlocks, rarity);
            return (
              <button
                key={t.key}
                type="button"
                aria-pressed={t.key === templateKey}
                disabled={shut}
                title={shut ? `${RARITY_LABELS[t.unlocks!]} and above` : t.name}
                className={`${styles.templateBtn} ${t.key === templateKey ? styles.templateActive : ''}`}
                onClick={() => pickTemplate(t.key)}
              >
                <TemplateThumb layout={t.key} />
                <strong>{t.name}</strong>
                {shut ? <span className={styles.lockTag}>{RARITY_LABELS[t.unlocks!]}</span> : null}
              </button>
            );
          })}
        </div>

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
        <div>
          <span className={styles.copyHeading}>Printed card copy</span>
          <p className={styles.copyNote}>
            Type on the card and drag the photo to frame it. Drag the border to turn it under the
            light.
          </p>
        </div>
        <TiltStage className={styles.proof} label="Turn the proof under the light">
          <CardPreview
            title={title}
            rarity={rarity}
            printedText={printedText}
            imageUrl={image?.url ?? null}
            templateKey={templateKey}
            templateConfig={prepareCardDesign(templateKey, config)}
            mark={mark}
            {...(code ? { code } : {})}
            {...(template ? { textRules: template.text } : {})}
            onTitleChange={setTitle}
            onPrintedTextChange={setPrintedText}
            onPhotoFrameChange={setFrame}
            lit
          />
        </TiltStage>
        {template ? (
          <p className={styles.copyCount}>
            Title {title.length}/{template.text.title.max_length}
            {template.text.printed
              ? ` · ${template.text.printed_label} ${printedText.length}/${template.text.printed.max_length}`
              : ''}
          </p>
        ) : null}
        {fields.printed_text?.map((m) => (
          <p key={m} className={styles.error}>
            {m}
          </p>
        ))}
      </div>
    </form>
  );
}
