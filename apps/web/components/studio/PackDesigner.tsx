'use client';

import type { CardSetDetail } from '@miscellary/shared';
import PackLayerEditor from './PackLayerEditor';
import PackPouch from '../PackPouch';
import PackTextEditor from './PackTextEditor';
import SetMark from '../SetMark';
import { ChoiceMenu, ColourMenu, Field, Section, Slider } from '../controls';
import ui from '../ui.module.css';
import {
  EMBLEM_LAYOUTS,
  EMBLEM_LAYOUT_LABELS,
  EMBLEM_SHAPES,
  EMBLEM_STYLES,
  EMBLEM_TEXT_NAMES,
  MARK_LABELS,
  PACK_SUBTITLE_MAX_LENGTH,
  PACK_COLOUR_FAMILIES,
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
        <Section
          title="Foil"
          note="The wrapper is one photograph recoloured, so any colour needs no new artwork."
        >
          <Field label="Colour">
            <ColourMenu
              value={set.pack_colour || 'mint'}
              values={PACK_COLOUR_NAMES}
              families={PACK_COLOUR_FAMILIES}
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

        <Section
          title="Front"
          note="Everything printed on the pack, painted bottom first. The set's own badge is a layer like any other, so it can sit over your artwork or under it."
        >
          <PackLayerEditor
            layers={set.pack_layers}
            onDraft={(pack_layers: PackLayer[]) => onDraft({ pack_layers })}
            onSave={(pack_layers: PackLayer[]) => onSave({ pack_layers })}
          />
        </Section>

        {hasEmblem ? (
          <Section
            title="Badge"
            note="How the set's own badge is drawn. Its overall size is set on its layer, above."
          >
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

        <Section
          title="Text"
          note="Your own words, anywhere on the pack, in any of the typefaces. Works over the built-in lockup and over your own artwork alike."
          defaultOpen={false}
        >
          <PackTextEditor
            layers={set.pack_text}
            onDraft={(pack_text: PackTextLayer[]) => onDraft({ pack_text })}
            onSave={(pack_text: PackTextLayer[]) => onSave({ pack_text })}
          />
        </Section>

        <Section
          title="Mark"
          note="The small symbol printed on this set's cards, its pack and its empty sleeves."
        >
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

        <Section title="Packs" note="How many cards a pack of this set holds." defaultOpen={false}>
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
