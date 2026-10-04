import { useState } from 'react';
import { View } from 'react-native';
import WebView from 'react-native-webview';
import bundle from '../generated/surfaces.json';
import { SURFACE_ORIGIN } from './SharedSurface';

// Starts the WebView engine and caches the shared surfaces' fonts and textures while the first
// screen loads, so the first card, pack or binder opens without that wait.
export default function SurfaceWarmup() {
  const [done, setDone] = useState(false);
  if (done) return null;
  const html = `<script>Promise.allSettled(${JSON.stringify(bundle.full.preload)}.map(u=>fetch(u))).then(()=>window.ReactNativeWebView.postMessage('done'))</script>`;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}>
      <WebView
        source={{ html, baseUrl: SURFACE_ORIGIN }}
        originWhitelist={['*']}
        javaScriptEnabled
        onMessage={() => setDone(true)}
        onError={() => setDone(true)}
      />
    </View>
  );
}
