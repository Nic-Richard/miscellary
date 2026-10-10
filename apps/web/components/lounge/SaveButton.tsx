'use client';

import { useEffect, useRef, useState } from 'react';
import type { SavedFolder } from '@miscellary/shared';
import { createFolder, listFolders, savePost } from '@/lib/lounge';
import ui from '@/components/ui.module.css';
import menu from '@/components/MoreMenu.module.css';
import SupporterPrompt from '@/components/SupporterPrompt';
import styles from './Lounge.module.css';

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
  const [open, setOpen] = useState(false);
  const [folders, setFolders] = useState<SavedFolder[] | null>(null);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    if (supporter && !folders)
      void listFolders()
        .then(setFolders)
        .catch(() => setFolders([]));
    function away(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
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
    <div className={menu.root} ref={root}>
      <button
        type="button"
        className={`${styles.act} ${saved ? styles.actOn : ''}`}
        aria-pressed={saved}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 3h12v18l-6-4-6 4Z" />
        </svg>
        {saved ? 'Saved' : 'Save'}
      </button>
      {open && (
        <div className={`${menu.menu} ${menu.menuRight} ${styles.saveMenu}`} role="menu">
          <button
            type="button"
            role="menuitemradio"
            aria-checked={saved && folderId === null}
            onClick={() => void choose(true)}
          >
            Saved
          </button>
          {saved && (
            <button type="button" role="menuitem" onClick={() => void choose(false)}>
              Remove from saved
            </button>
          )}
          <hr className={menu.rule} />
          {supporter ? (
            <>
              {folders?.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={saved && folderId === folder.id}
                  onClick={() => void choose(true, folder.id)}
                >
                  {folder.name}
                </button>
              ))}
              {naming ? (
                <form
                  className={styles.folderForm}
                  onSubmit={(event) => {
                    event.preventDefault();
                    void addFolder();
                  }}
                >
                  <input
                    className={ui.input}
                    aria-label="Folder name"
                    placeholder="Folder name"
                    maxLength={40}
                    autoFocus
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                  <button type="submit" className={`${ui.btnPrimary} ${ui.btnSmall}`}>
                    Add
                  </button>
                </form>
              ) : (
                <button type="button" role="menuitem" onClick={() => setNaming(true)}>
                  New folder…
                </button>
              )}
            </>
          ) : (
            <SupporterPrompt compact>
              Supporters can sort saved discussions into folders.
            </SupporterPrompt>
          )}
          {error && (
            <p role="alert" className={ui.error}>
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
