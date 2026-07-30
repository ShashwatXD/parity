'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronRight, Database, File, Folder, RefreshCw, Search } from 'lucide-react';
import { ragRepository, type RagStatus } from '@/lib/api/repositories/ragRepository';
import {
  workspaceRepository,
  type WorkspaceNode,
} from '@/lib/api/repositories/workspaceRepository';
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

export function FilesPanel() {
  const [root, setRoot] = useState('');
  const [tree, setTree] = useState<WorkspaceNode | null>(null);
  const [selected, setSelected] = useState('.');
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [rag, setRag] = useState<RagStatus | null>(null);
  const [ragQuery, setRagQuery] = useState('');
  const [ragHits, setRagHits] = useState<
    Array<{ path: string; startLine: number; endLine: number; score: number; content: string }>
  >([]);

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
      if (status.lastError) setError(`Indexed with lexical fallback: ${status.lastError}`);
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
          <strong>Files</strong>
          <span className="mono dim" title={root}>
            {root ? root.replace(/.*\//, '…/') : '…'}
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
            disabled={indexing}
          >
            <Database size={14} className={indexing ? 'spin' : undefined} />
          </button>
          <button type="button" className="icon-btn" onClick={() => void refresh()} title="Refresh">
            <RefreshCw size={14} className={loading ? 'spin' : undefined} />
          </button>
        </div>
      </div>

      <form className="rag-search-row" onSubmit={(ev) => void runRagSearch(ev)}>
        <Search size={13} />
        <input
          value={ragQuery}
          onChange={(e) => setRagQuery(e.target.value)}
          placeholder="RAG search workspace…"
          spellCheck={false}
        />
        <button type="submit" className="icon-btn" title="Search">
          <Search size={13} />
        </button>
      </form>

      {error ? <div className="files-panel-error">{error}</div> : null}
      <div className="files-panel-split">
        <div className="files-panel-tree">
          {tree ? (
            <TreeNode node={tree} depth={0} selected={selected} onSelect={(n) => void onSelect(n)} />
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
              Select a file, or set embedding key (Settings → Workspace) → Reindex → RAG search.
              Agent tool: <span className="mono">codebase_search</span> (vector-only).
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
