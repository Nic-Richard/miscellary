import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import WebView from 'react-native-webview';
import { router } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import type { CreateUploadResponse, ImageKind, ImageRef } from '@miscellary/shared';
import { apiFetch } from '@/lib/api';
import { ErrorText } from './ui';
import bundle from '../generated/surfaces.json';

interface Props {
  mode: string;
  data: object;
  width?: number;
  height?: number;
  autoHeight?: boolean;
  passive?: boolean;
  onEvent?: (type: string, data: unknown) => void;
}
const literal = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');

export default function SharedSurface({
  mode,
  data,
  width,
  height,
  autoHeight,
  passive,
  onEvent,
}: Props) {
  const view = useRef<WebView>(null);
  const ready = useRef(false);
  const [measuredHeight, setMeasuredHeight] = useState(500);
  const [error, setError] = useState('');
  const props = useRef({ mode, data });
  props.current = { mode, data };
  function render() {
    view.current?.injectJavaScript(`window.miscellaryRender(${literal(props.current)});true;`);
  }
  useEffect(() => {
    if (ready.current) render();
  }, [mode, data]);

  async function upload(input: {
    data: string;
    kind: ImageKind;
    contentType: string;
    width: number;
    height: number;
  }) {
    if (
      !['card', 'art', 'avatar'].includes(input.kind) ||
      input.data.length > 14_000_000 ||
      !['image/png', 'image/jpeg', 'image/webp'].includes(input.contentType)
    )
      throw new Error('Unsupported image.');
    const file = `${FileSystem.cacheDirectory}surface-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      await FileSystem.writeAsStringAsync(file, input.data, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const { image, upload_url, max_size } = await apiFetch<CreateUploadResponse>(
        '/api/v1/uploads/',
        { method: 'POST', body: { kind: input.kind, content_type: input.contentType } },
      );
      if (input.data.length * 0.75 > max_size) throw new Error('Image is too large.');
      const response = await FileSystem.uploadAsync(upload_url, file, {
        httpMethod: 'PUT',
        headers: { 'Content-Type': input.contentType },
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      });
      if (response.status < 200 || response.status >= 300) throw new Error('Upload failed.');
      return await apiFetch<ImageRef>(`/api/v1/uploads/${image.id}/complete/`, {
        method: 'POST',
        body: { width: input.width, height: input.height },
      });
    } finally {
      await FileSystem.deleteAsync(file, { idempotent: true });
    }
  }
  return (
    <View
      pointerEvents={passive ? 'none' : 'auto'}
      style={{
        width,
        height: autoHeight ? measuredHeight : height,
        flex: height || autoHeight ? undefined : 1,
        backgroundColor: 'transparent',
      }}
    >
      {error ? <ErrorText>{error}</ErrorText> : null}
      <WebView
        ref={view}
        source={mode === 'card' ? bundle.card : mode === 'pack' ? bundle.pack : bundle.full}
        originWhitelist={['*']}
        javaScriptEnabled
        scrollEnabled={!autoHeight && !passive}
        automaticallyAdjustContentInsets={false}
        setSupportMultipleWindows={false}
        style={{ backgroundColor: 'transparent', flex: 1 }}
        onShouldStartLoadWithRequest={(request) =>
          request.url === 'about:blank' || request.url.startsWith('data:text/html')
        }
        onError={(event) => setError(event.nativeEvent.description)}
        onContentProcessDidTerminate={() => {
          ready.current = false;
          view.current?.reload();
        }}
        onMessage={(event) => {
          void (async () => {
            const message = JSON.parse(event.nativeEvent.data);
            if (message.type === 'ready') {
              ready.current = true;
              render();
              return;
            }
            if (message.type === 'height') {
              if (Number.isFinite(message.data) && message.data > 0)
                setMeasuredHeight(Math.ceil(message.data));
              return;
            }
            if (message.type === 'navigate') {
              if (typeof message.data === 'string' && /^\/(sets|users)\/[\w-]+$/.test(message.data))
                router.push(message.data);
              return;
            }
            if (message.type === 'request' || message.type === 'upload') {
              try {
                if (!mode.endsWith('editor')) throw new Error('This surface is read-only.');
                let result;
                if (message.type === 'upload') result = await upload(message.data);
                else {
                  const input = message.data;
                  const context = data as { setId?: string; set?: { id: string } };
                  const setId = context.setId ?? context.set?.id;
                  if (
                    !setId ||
                    !input.path.startsWith(`/api/v1/me/sets/${setId}/`) ||
                    !['GET', 'POST', 'PATCH'].includes(input.method) ||
                    input.path.includes('..')
                  )
                    throw new Error('Unsupported editor request.');
                  result = await apiFetch(input.path, { method: input.method, body: input.body });
                }
                view.current?.injectJavaScript(
                  `window.miscellaryReply(${literal({ id: message.id, data: result ?? null })});true;`,
                );
              } catch (reason) {
                view.current?.injectJavaScript(
                  `window.miscellaryReply(${literal({ id: message.id, error: reason instanceof Error ? reason.message : 'Could not save.' })});true;`,
                );
              }
              return;
            }
            onEvent?.(message.type, message.data);
          })().catch(() => setError('Could not load this view. Please reopen it.'));
        }}
      />
    </View>
  );
}
