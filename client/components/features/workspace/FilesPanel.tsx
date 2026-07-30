'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronRight, Database, File, Folder, FolderOpen, RefreshCw, Search } from 'lucide-react';
import { ragRepository, type RagStatus } from '@/lib/api/repositories/ragRepository';
import { settingsRepository } from '@/lib/api/repositories/settingsRepository';
import {
  workspaceRepository,
  type WorkspaceNode,
} from '@/lib/api/repositories/workspaceRepository';
import { canPickDirectory, pickWorkspaceDirectory } from '@/lib/workspace/pickDirectory';
import { subscribeWorkspaceChanged } from '@/lib/workspace/events';
import { cn } from '@/lib/utils/cn';

function TreeNode({
  node,
  depth,
  selected,
  onSelect,
}: {
  node: WorkspaceNode;
  depth: number;
  selected: string;
  onSelect: (node: WorkspaceNode) => void;
}) {
  const [open, setOpen] = useState(depth < 2);
  const isDir = node.kind === 'dir';
  return (
    <div>
      <button
        type="button"
        className={cn('file-tree-row', selected === node.path && 'active')}
        style={{ paddingLeft: 8 + depth * 12 }}
        onClick={() => {
          if (isDir) setOpen((v) => !v);
          onSelect(node);
        }}
      >
        {isDir ? (
          <ChevronRight size={12} className={cn('file-tree-chevron', open && 'open')} />
        ) : (
          <span style={{ width: 12 }} />
        )}
        {isDir ? <Folder size={13} /> : <File size={13} />}
        <span className="file-tree-name">{node.name}</span>
      </button>
      {isDir && open && node.children?.map((child) => (
        <TreeNode
          key={child.path}
          node={child}
          depth={depth + 1}
          selected={selected}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function countFiles(node: WorkspaceNode | null): number {
  if (!node) return 0;
  if (node.kind === 'file') return 1;
  return (node.children ?? []).reduce((n, c) => n + countFiles(c), 0);
}

export function FilesPanel() {
  const [root, setRoot] = useState('');
  const [pathDraft, setPathDraft] = useState('');
  const [tree, setTree] = useState<WorkspaceNode | null>(null);
  const [selected, setSelected] = useState('.');
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingPath, setSavingPath] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [rag, setRag] = useState<RagStatus | null>(null);
  const [ragQuery, setRagQuery] = useState('');
  const [ragHits, setRagHits] = useState<
    Array<{ path: string; startLine: number; endLine: number; score: number; content: string }>
  >([]);

  const fileCount = countFiles(tree);
  const needsWorkspace = fileCount <= 1;

  const refreshRag = useCallback(async () => {
    try {
      setRag(await ragRepository.status());
    } catch {
      setRag(null);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await workspaceRepository.tree('.', 4);
      setRoot(data.root);
      setPathDraft(data.root);
      setTree(data.tree);
      await refreshRag();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [refreshRag]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => subscribeWorkspaceChanged(() => void refresh()), [refresh]);

  // Rebuild tree while the panel is open (agent file_editor / terminal writes)
  useEffect(() => {
    const t = window.setInterval(() => void refresh(), 2500);
    return () => window.clearInterval(t);
  }, [refresh]);

  async function applyWorkspacePath(next: string) {
    setSavingPath(true);
    setError('');
    setOk('');
    try {
      await settingsRepository.update({ workspaceRoot: next.trim() });
      setSelected('.');
      setContent('');
      setRagHits([]);
      await refresh();
      setOk(next.trim() ? 'Workspace path updated' : 'Using default workspace');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingPath(false);
    }
  }

  async function selectFolder() {
    setSelecting(true);
    setError('');
    setOk('');
    try {
      // Prefer native dialog on the API host → real path like /Users/…/Desktop/bruno
      const res = await workspaceRepository.pick();
      setPathDraft(res.root);
      setRoot(res.root);
      setSelected('.');
      setContent('');
      setRagHits([]);
      await refresh();
      setOk(`Workspace: ${res.root}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/cancel/i.test(msg)) return;
      // Remote API / no GUI: fall back to browser picker + sync copy
      try {
        if (!canPickDirectory()) throw e;
        const picked = await pickWorkspaceDirectory();
        const res = await workspaceRepository.sync(picked.files, picked.name);
        setPathDraft(res.root);
        setRoot(res.root);
        setSelected('.');
        setContent('');
        setRagHits([]);
        await refresh();
        setOk(`Workspace synced “${picked.name}” (${res.fileCount} files) — copy on API host`);
      } catch (e2) {
        if (e2 instanceof DOMException && e2.name === 'AbortError') return;
        setError(e2 instanceof Error ? e2.message : String(e2));
      }
    } finally {
      setSelecting(false);
    }
  }

  async function onSelect(node: WorkspaceNode) {
    setSelected(node.path);
    setRagHits([]);
    if (node.kind !== 'file') {
      setContent('');
      return;
    }
    try {
      const file = await workspaceRepository.readFile(node.path);
      setContent(file.content);
      setError(file.truncated ? 'Preview truncated' : '');
    } catch (e) {
      setContent('');
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function reindex() {
    setIndexing(true);
    setError('');
    try {
      const status = await ragRepository.index(true);
      setRag(status);
      if (status.lastError) setError(status.lastError);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIndexing(false);
    }
  }

  async function runRagSearch(e?: React.FormEvent) {
    e?.preventDefault();
    const q = ragQuery.trim();
    if (!q) return;
    setError('');
    try {
      const res = await ragRepository.search(q, 6);
      setRagHits(res.hits);
      setContent('');
      if (!res.hits.length && res.mode === 'empty') {
        setError('Index empty — click Reindex first');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="files-panel">
      <div className="files-panel-toolbar">
        <div className="files-panel-meta">
          <strong>Workspace</strong>
          <span className="mono dim" title={root}>
            {root || '…'}
          </span>
          {rag ? (
            <span className="mono dim">
              RAG {rag.chunkCount} chunks · {rag.embeddingMode}
            </span>
          ) : null}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            type="button"
            className="icon-btn"
            onClick={() => void reindex()}
            title="Reindex workspace for RAG"
            disabled={indexing || needsWorkspace}
          >
            <Database size={14} className={indexing ? 'spin' : undefined} />
          </button>
          <button type="button" className="icon-btn" onClick={() => void refresh()} title="Refresh">
            <RefreshCw size={14} className={loading ? 'spin' : undefined} />
          </button>
        </div>
      </div>

      <div className="workspace-path-row">
        <button
          type="button"
          className="files-path-btn"
          disabled={selecting || !canPickDirectory()}
          title="Open system folder dialog"
          onClick={() => void selectFolder()}
        >
          <FolderOpen size={13} style={{ marginRight: 4, verticalAlign: '-2px' }} />
          {selecting ? 'Loading…' : 'Select folder'}
        </button>
      </div>

      <form
        className="workspace-path-row"
        onSubmit={(ev) => {
          ev.preventDefault();
          void applyWorkspacePath(pathDraft);
        }}
      >
        <Folder size={13} />
        <input
          value={pathDraft}
          onChange={(e) => setPathDraft(e.target.value)}
          placeholder="Or absolute path on API host → Set"
          spellCheck={false}
          title={root || 'Workspace root'}
        />
        <button type="submit" className="files-path-btn" disabled={savingPath}>
          {savingPath ? '…' : 'Set'}
        </button>
        <button
          type="button"
          className="files-path-btn secondary"
          disabled={savingPath}
          onClick={() => void applyWorkspacePath('')}
        >
          Default
        </button>
      </form>

      <form className="rag-search-row" onSubmit={(ev) => void runRagSearch(ev)}>
        <Search size={13} />
        <input
          value={ragQuery}
          onChange={(e) => setRagQuery(e.target.value)}
          placeholder="RAG search workspace…"
          spellCheck={false}
          disabled={needsWorkspace}
        />
        <button type="submit" className="icon-btn" title="Search" disabled={needsWorkspace}>
          <Search size={13} />
        </button>
      </form>

      {error ? <div className="files-panel-error">{error}</div> : null}
      {ok ? <div className="files-panel-ok">{ok}</div> : null}
      <div className="files-panel-split">
        <div className="files-panel-tree">
          {tree ? (
            <TreeNode
              key={`${root}:${fileCount}:${tree.children?.length ?? 0}`}
              node={tree}
              depth={0}
              selected={selected}
              onSelect={(n) => void onSelect(n)}
            />
          ) : (
            <p className="muted pad-sm">Loading workspace…</p>
          )}
        </div>
        <div className="files-panel-preview">
          {ragHits.length ? (
            <div className="rag-hits">
              {ragHits.map((h) => (
                <button
                  key={`${h.path}:${h.startLine}`}
                  type="button"
                  className="rag-hit"
                  onClick={() => {
                    setSelected(h.path);
                    setContent(h.content);
                    setRagHits([]);
                  }}
                >
                  <span className="mono">
                    {h.path}:{h.startLine}-{h.endLine}
                  </span>
                  <span className="dim">score {h.score.toFixed(3)}</span>
                  <pre>{h.content.slice(0, 280)}</pre>
                </button>
              ))}
            </div>
          ) : content ? (
            <pre className="files-preview-code">{content}</pre>
          ) : (
            <p className="muted pad-sm">
              {needsWorkspace
                ? 'Select folder (system dialog), then chat / Reindex.'
                : 'Select a file, or Reindex → RAG search.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
