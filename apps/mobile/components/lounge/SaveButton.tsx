import { useEffect, useState } from 'react';
import Feather from '@expo/vector-icons/Feather';
import { Pressable, Text, View } from 'react-native';
import type { SavedFolder } from '@miscellary/shared';
import ActionChip from '@/components/ActionChip';
import Sheet from '@/components/Sheet';
import SupporterPrompt from '@/components/SupporterPrompt';
import { Button, ErrorText, Input } from '@/components/ui';
import { createFolder, listFolders, savePost } from '@/lib/lounge';
import { createThemedStyles, fonts, useColors } from '@/lib/theme';

export default function SaveButton({
  postId,
  saved,
  folderId,
  supporter,
  onChange,
}: {
  postId: string;
  saved: boolean;
  folderId: number | null;
  supporter: boolean;
  onChange: (saved: boolean, folderId: number | null) => void;
}) {
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const [folders, setFolders] = useState<SavedFolder[] | null>(null);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && supporter && !folders)
      void listFolders()
        .then(setFolders)
        .catch(() => setFolders([]));
  }, [open, supporter, folders]);

  async function choose(next: boolean, folder: number | null = null) {
    setError(null);
    try {
      const result = await savePost(postId, next, folder);
      onChange(result.saved, result.folder_id);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that.');
    }
  }

  async function addFolder() {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const folder = await createFolder(trimmed);
      setFolders((current) => [...(current ?? []).filter((f) => f.id !== folder.id), folder]);
      setNaming(false);
      setName('');
      await choose(true, folder.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not make that folder.');
    }
  }

  return (
    <>
      <ActionChip
        icon="bookmark"
        label={saved ? 'Saved' : 'Save'}
        tone={saved ? 'on' : 'plain'}
        onPress={() => setOpen(true)}
      />
      <Sheet visible={open} title="Save discussion" onClose={() => setOpen(false)}>
        <Option
          label="Saved"
          icon="bookmark"
          on={saved && folderId === null}
          onPress={() => void choose(true)}
        />
        {supporter ? (
          <>
            {folders?.map((folder) => (
              <Option
                key={folder.id}
                label={folder.name}
                icon="folder"
                on={saved && folderId === folder.id}
                onPress={() => void choose(true, folder.id)}
              />
            ))}
            {naming ? (
              <View style={styles.naming}>
                <Input
                  accessibilityLabel="Folder name"
                  placeholder="Folder name"
                  maxLength={40}
                  autoFocus
                  value={name}
                  onChangeText={setName}
                  onSubmitEditing={() => void addFolder()}
                  style={{ flex: 1 }}
                />
                <Button title="Add" disabled={!name.trim()} onPress={() => void addFolder()} />
              </View>
            ) : (
              <Option label="New folder" icon="folder-plus" onPress={() => setNaming(true)} />
            )}
          </>
        ) : (
          <SupporterPrompt>Supporters can sort saved discussions into folders.</SupporterPrompt>
        )}
        {saved && <Option label="Remove from saved" icon="x" onPress={() => void choose(false)} />}
        <ErrorText>{error}</ErrorText>
      </Sheet>
    </>
  );
}

function Option({
  label,
  icon,
  on = false,
  onPress,
}: {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  on?: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={({ pressed }) => [styles.option, (pressed || on) && styles.optionOn]}
    >
      <Feather name={icon} size={18} color={colors.accentInk} />
      <Text style={styles.label}>{label}</Text>
      {on && <Feather name="check" size={18} color={colors.accentInk} />}
    </Pressable>
  );
}

const useStyles = createThemedStyles((colors) => ({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.bdr,
    backgroundColor: colors.sur,
  },
  optionOn: { borderColor: colors.accent, backgroundColor: colors.sur2 },
  label: { flex: 1, color: colors.text, fontFamily: fonts.medium, fontSize: 16 },
  naming: { flexDirection: 'row', alignItems: 'center', gap: 8 },
}));
