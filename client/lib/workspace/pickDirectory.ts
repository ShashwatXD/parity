/** Browser File System Access — native OS folder dialog (OpenHands-like pick UX). */

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  '.data',
  'coverage',
  '.turbo',
  '.cache',
  'vendor',
  '__pycache__',
  '.venv',
  'venv',
]);

const MAX_FILE_BYTES = 400_000;

type DirHandle = FileSystemDirectoryHandle;
type FileHandle = FileSystemFileHandle;

async function readFileText(handle: FileHandle): Promise<string | null> {
  const file = await handle.getFile();
  if (file.size > MAX_FILE_BYTES) return null;
  if (/\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|wasm|exe|dll|so|dylib|bin)$/i.test(file.name)) {
    return null;
  }
  try {
    const text = await file.text();
    if (text.includes('\u0000')) return null;
    return text;
  } catch {
    return null;
  }
}

async function walkDir(
  dir: DirHandle,
  prefix: string,
  out: Array<{ path: string; content: string }>,
): Promise<void> {
  const dirAny = dir as DirHandle & {
    entries?: () => AsyncIterableIterator<[string, FileSystemHandle]>;
  };
  const entries =
    typeof dirAny.entries === 'function'
      ? dirAny.entries()
      : (dir as unknown as AsyncIterable<[string, FileSystemHandle]>);

  for await (const [name, handle] of entries) {
    if (name.startsWith('.') && name !== '.env.example') continue;
    if (handle.kind === 'directory') {
      if (SKIP_DIRS.has(name)) continue;
      await walkDir(handle as DirHandle, prefix ? `${prefix}/${name}` : name, out);
    } else if (handle.kind === 'file') {
      const content = await readFileText(handle as FileHandle);
      if (content == null) continue;
      out.push({ path: prefix ? `${prefix}/${name}` : name, content });
    }
  }
}

export type PickedWorkspace = {
  name: string;
  files: Array<{ path: string; content: string }>;
};

export function canPickDirectory(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

/** Native folder picker; returns text files for sync to the API workspace. */
export async function pickWorkspaceDirectory(): Promise<PickedWorkspace> {
  if (!canPickDirectory()) {
    throw new Error(
      'Folder picker needs Chrome/Edge. Or paste an absolute path below and Set (API must see that path).',
    );
  }
  const w = window as unknown as {
    showDirectoryPicker: (opts?: { mode?: 'read' | 'readwrite' }) => Promise<DirHandle>;
  };
  const dir = await w.showDirectoryPicker({ mode: 'read' });
  const files: Array<{ path: string; content: string }> = [];
  await walkDir(dir, '', files);
  if (!files.length) {
    throw new Error('No readable text files found (node_modules/.git skipped).');
  }
  return { name: dir.name, files };
}
