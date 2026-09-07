let sequence = 0;
const pending = new Map<
  number,
  { resolve: (data: unknown) => void; reject: (error: Error) => void }
>();
declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (message: string) => void };
    miscellaryReply: (reply: { id: number; data?: unknown; error?: string }) => void;
    miscellaryRender: (props: Record<string, unknown>) => void;
  }
}
export function send(type: string, data?: unknown) {
  window.ReactNativeWebView?.postMessage(JSON.stringify({ type, data }));
}
window.miscellaryReply = ({ id, data, error }) => {
  const callback = pending.get(id);
  pending.delete(id);
  if (error) callback?.reject(new Error(error));
  else callback?.resolve(data);
};
export function request(type: string, data: unknown): Promise<unknown> {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    window.ReactNativeWebView?.postMessage(JSON.stringify({ type, data, id }));
  });
}
