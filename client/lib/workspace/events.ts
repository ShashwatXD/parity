const WORKSPACE_EVENT = 'parity:workspace-changed';

/** Tell Files / Terminal panels to reload from the API. */
export function notifyWorkspaceChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(WORKSPACE_EVENT));
}

export function subscribeWorkspaceChanged(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const handler = () => cb();
  window.addEventListener(WORKSPACE_EVENT, handler);
  return () => window.removeEventListener(WORKSPACE_EVENT, handler);
}
