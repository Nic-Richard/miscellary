'use client';

import type { CardSetDetail } from '@miscellary/shared';
import PackLayerEditor from './PackLayerEditor';
import PackPouch from '../PackPouch';
import PackTextEditor from './PackTextEditor';
import BinderColourPicker from '../BinderColourPicker';
import SetMark from '../SetMark';
import { ChoiceMenu, ColourMenu, Field, Section, Slider } from '../controls';
import ui from '../ui.module.css';
import { normaliseSetCode, SET_CODE_LENGTH, setCodeProblems } from '@miscellary/shared';
import {
  EMBLEM_LAYOUTS,
  EMBLEM_LAYOUT_LABELS,
  EMBLEM_SHAPES,
  EMBLEM_STYLES,
  EMBLEM_TEXT_NAMES,
  MARK_LABELS,
  PACK_SUBTITLE_MAX_LENGTH,
  PACK_COLOUR_NAMES,
  PACK_FINISHES,
  SCALE_MAX,
  SCALE_MIN,
  SET_MARKS,
  packSwatchStyle,
} from '@/lib/setIdentity';
import type { PackLayer, PackTextLayer } from '@/lib/setIdentity';
import type { SetWrite } from '@/lib/sets';
import styles from './PackDesigner.module.css';

interface PackDesignerProps {
  set: CardSetDetail;
  onDraft: (patch: Partial<CardSetDetail>) => void;
  onSave: (patch: Partial<SetWrite>) => void;
}

const STYLE_LABELS: Record<string, string> = {
  filled: 'Filled plate',
  outline: 'Outline',
  transparent: 'Printed on foil',
};

const FINISH_LABELS: Record<string, string> = {
  gloss: 'Gloss',
  satin: 'Satin',
  matte: 'Matte',
  holo: 'Holographic',
};

export default function PackDesigner({ set, onDraft, onSave }: PackDesignerProps) {
  const wordmark = (set.emblem_layout || 'seal') === 'wordmark';
  const hasEmblem = set.pack_layers.some((layer) => layer.kind === 'emblem');

  return (
    <div className={styles.root}>
      <div className={styles.controls}>
        <Section title="Foil">
          <Field label="Colour">
            <ColourMenu
              value={set.pack_colour || 'mint'}
              values={PACK_COLOUR_NAMES}
              swatchFor={packSwatchStyle}
              onChange={(v) => onSave({ pack_colour: v })}
            />
          </Field>
          <Field label="Finish">
            <ChoiceMenu
              value={set.pack_finish || 'gloss'}
              values={[...PACK_FINISHES]}
              labels={FINISH_LABELS}
              onChange={(v) => onSave({ pack_finish: v })}
            />
          </Field>
        </Section>

        <Section title="Front" note="Painted bottom first.">
          <PackLayerEditor
            layers={set.pack_layers}
            onDraft={(pack_layers: PackLayer[]) => onDraft({ pack_layers })}
            onSave={(pack_layers: PackLayer[]) => onSave({ pack_layers })}
          />
        </Section>

        {hasEmblem ? (
          <Section title="Badge">
            <Field label="Layout">
              <ChoiceMenu
                value={set.emblem_layout || 'seal'}
                values={[...EMBLEM_LAYOUTS]}
                labels={EMBLEM_LAYOUT_LABELS}
                onChange={(v) => onSave({ emblem_layout: v })}
              />
            </Field>
            {!wordmark ? (
              <>
                <Field label="Plate">
                  <ChoiceMenu
                    value={set.emblem_shape || 'disc'}
                    values={[...EMBLEM_SHAPES]}
                    onChange={(v) => onSave({ emblem_shape: v })}
                  />
                </Field>
                <Field label="Style">
                  <ChoiceMenu
                    value={set.emblem_style || 'filled'}
                    values={[...EMBLEM_STYLES]}
                    labels={STYLE_LABELS}
                    onChange={(v) => onSave({ emblem_style: v })}
                  />
                </Field>
              </>
            ) : null}
            <Field label="Ink">
              <ColourMenu
                value={set.emblem_text || 'teal'}
                values={EMBLEM_TEXT_NAMES}
                onChange={(v) => onSave({ emblem_text: v })}
              />
            </Field>
            <Field label="Text size">
              <Slider
                value={set.emblem_type_scale}
                min={SCALE_MIN}
                max={SCALE_MAX}
                suffix="%"
                onChange={(v) => onDraft({ emblem_type_scale: v })}
                onCommit={(v) => onSave({ emblem_type_scale: v })}
              />
            </Field>
            <Field label="Mark size">
              <Slider
                value={set.mark_scale}
                min={SCALE_MIN}
                max={SCALE_MAX}
                suffix="%"
                onChange={(v) => onDraft({ mark_scale: v })}
                onCommit={(v) => onSave({ mark_scale: v })}
              />
            </Field>
            <Field label="Sub-line">
              <input
                className={ui.input}
                aria-label="Sub-line"
                value={set.pack_subtitle}
                maxLength={PACK_SUBTITLE_MAX_LENGTH}
                placeholder="None"
                onChange={(e) => onDraft({ pack_subtitle: e.target.value })}
                onBlur={(e) => onSave({ pack_subtitle: e.target.value })}
              />
            </Field>
          </Section>
        ) : null}

        <Section title="Text" defaultOpen={false}>
          <PackTextEditor
            layers={set.pack_text}
            onDraft={(pack_text: PackTextLayer[]) => onDraft({ pack_text })}
            onSave={(pack_text: PackTextLayer[]) => onSave({ pack_text })}
          />
        </Section>

        <Section title="Mark" note="Printed on this set's cards, pack and sleeves.">
          <Field label="Symbol">
            <div className={styles.marks}>
              {[...SET_MARKS, 'none'].map((m) => (
                <button
                  key={m}
                  type="button"
                  title={MARK_LABELS[m]}
                  aria-label={MARK_LABELS[m]}
                  aria-pressed={(set.mark || 'waves') === m}
                  className={`${styles.mark} ${(set.mark || 'waves') === m ? styles.markOn : ''}`}
                  onClick={() => onSave({ mark: m })}
                >
                  {m === 'none' ? (
                    <span className={styles.markNone}>None</span>
                  ) : (
                    <SetMark mark={m} />
                  )}
                </button>
              ))}
            </div>
          </Field>
        </Section>

        <Section
          title="Card code"
          note="Three characters, printed with each card's position. Blank takes it from the title."
        >
          <Field label="Code">
            <input
              className={`${ui.input} ${styles.code}`}
              value={set.set_code}
              placeholder={set.suggested_set_code}
              maxLength={SET_CODE_LENGTH}
              aria-label="Set code"
              onChange={(event) => onDraft({ set_code: normaliseSetCode(event.target.value) })}
              onBlur={(event) => {
                const next = normaliseSetCode(event.target.value);
                if (!setCodeProblems(next).length) onSave({ set_code: next });
              }}
            />
          </Field>
          {setCodeProblems(set.set_code).map((problem) => (
            <p key={problem} className={styles.codeNote}>
              {problem}
            </p>
          ))}
          <p className={styles.codePreview}>
            Prints <b>{set.printed_set_code}</b>. Publishing adds a two-character number.
          </p>
        </Section>

        <Section title="Binder">
          <Field label="Cover">
            <BinderColourPicker
              value={set.binder_colour || 'teal'}
              onChange={(v) => onSave({ binder_colour: v })}
            />
          </Field>
        </Section>

        <Section title="Packs" defaultOpen={false}>
          <Field label="Pack size">
            <Slider
              value={set.pack_size}
              min={1}
              max={10}
              onChange={(v) => onDraft({ pack_size: v })}
              onCommit={(v) => onSave({ pack_size: v })}
            />
          </Field>
        </Section>
      </div>

      <div className={styles.preview}>
        <PackPouch title={set.title} identity={set} />
        <span className={styles.previewLabel}>Live pack preview</span>
      </div>
    </div>
  );
}
