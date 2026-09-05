import {
  DESCRIPTION_MAX_LENGTH,
  RARITIES,
  RARITY_LABELS,
  validateDescription,
} from '@miscellary/shared';
import type { CardTemplate, ImageRef, Rarity, TemplateConfig } from '@miscellary/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import CardPreview from '@/components/CardPreview';
import { ApiRequestError } from '@/lib/api';
import { createCard, getMySet, listTemplates, updateCard } from '@/lib/endpoints';
import { colors } from '@/lib/theme';
import { pickPhoto, takePhoto, uploadAsset } from '@/lib/upload';
import { Button, Chip, ErrorText, Input, Muted } from '@/components/ui';

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

export default function CardScreen() {
  const { setId, cardId } = useLocalSearchParams<{ setId: string; cardId?: string }>();
  const [templates, setTemplates] = useState<CardTemplate[]>([]);
  const [image, setImage] = useState<ImageRef | null>(null);
  const [title, setTitle] = useState('');
  const [rarity, setRarity] = useState<Rarity>('common');
  const [description, setDescription] = useState('');
  const [templateKey, setTemplateKey] = useState('classic');
  const [config, setConfig] = useState<TemplateConfig>({});
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const list = await listTemplates();
      setTemplates(list);
      if (cardId) {
        const set = await getMySet(setId);
        const card = set.cards.find((c) => c.id === cardId);
        if (card) {
          setImage(card.image);
          setTitle(card.title);
          setRarity(card.rarity);
          setDescription(card.description);
          setTemplateKey(card.template_key);
          setConfig(card.template_config);
          return;
        }
      }
      const first = list[0];
      if (first) {
        setTemplateKey(first.key);
        setConfig(defaults(first));
      }
    })().catch((e: Error) => setError(e.message));
  }, [setId, cardId]);

  const template = templates.find((t) => t.key === templateKey);
  const issues = validateDescription(description);

  async function photo(fromCamera: boolean) {
    setError(null);
    try {
      const asset = fromCamera ? await takePhoto() : await pickPhoto();
      if (!asset) return;
      setUploading(true);
      setImage(await uploadAsset(asset, 'card'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not use that photo.');
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!image) {
      setError('Take a photo first.');
      return;
    }
    setBusy(true);
    setError(null);
    const body = {
      image_id: image.id,
      title,
      rarity,
      description,
      template_key: templateKey,
      template_config: config,
    };
    try {
      if (cardId) await updateCard(setId, cardId, body);
      else await createCard(setId, body);
      router.back();
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Could not save the card.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
    >
      <View style={{ alignItems: 'center' }}>
        <CardPreview
          width={220}
          title={title}
          rarity={rarity}
          description={description}
          imageUrl={image?.url ?? null}
          templateKey={templateKey}
          templateConfig={config}
        />
      </View>
      <View style={styles.row}>
        <Button
          title={uploading ? 'Uploading…' : image ? '📷 Retake' : '📷 Take photo'}
          disabled={uploading}
          onPress={() => void photo(true)}
          style={{ flex: 1 }}
        />
        <Button
          title="Choose from gallery"
          kind="secondary"
          disabled={uploading}
          onPress={() => void photo(false)}
          style={{ flex: 1 }}
        />
      </View>
      <ErrorText>{error}</ErrorText>

      <Input placeholder="Title" value={title} onChangeText={setTitle} maxLength={60} />

      <Muted style={styles.label}>Rarity</Muted>
      <View style={styles.chips}>
        {RARITIES.map((r) => (
          <Chip
            key={r}
            label={RARITY_LABELS[r]}
            active={rarity === r}
            onPress={() => setRarity(r)}
          />
        ))}
      </View>

      <Input
        placeholder="Description (**bold**, *italic*, - bullets)"
        value={description}
        onChangeText={setDescription}
        multiline
        style={{ minHeight: 80 }}
      />
      {issues.map((i) => (
        <Text key={i} style={{ color: colors.danger, fontSize: 12 }}>
          {ISSUE_TEXT[i]}
        </Text>
      ))}

      <Muted style={styles.label}>Template</Muted>
      <View style={styles.chips}>
        {templates.map((t) => (
          <Chip
            key={t.key}
            label={t.name}
            active={t.key === templateKey}
            onPress={() => {
              setTemplateKey(t.key);
              setConfig(defaults(t));
            }}
          />
        ))}
      </View>
      {template
        ? Object.entries(template.options).map(([name, opt]) => (
            <View key={name} style={styles.option}>
              <Muted style={{ fontSize: 12, width: 70 }}>{opt.label}</Muted>
              <View style={styles.chips}>
                {opt.values.map((v) => (
                  <Chip
                    key={v}
                    label={v}
                    active={config[name] === v}
                    onPress={() => setConfig({ ...config, [name]: v })}
                  />
                ))}
              </View>
            </View>
          ))
        : null}

      <Button
        title={busy ? 'Saving…' : cardId ? 'Save card' : 'Add card'}
        disabled={busy || uploading || issues.length > 0 || !title.trim()}
        onPress={() => void save()}
      />
      <Button title="Cancel" kind="secondary" onPress={() => router.back()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  label: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, flex: 1 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
