'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronRight, File, Folder, RefreshCw } from 'lucide-react';
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

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await workspaceRepository.tree('.', 4);
      setRoot(data.root);
      setTree(data.tree);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onSelect(node: WorkspaceNode) {
    setSelected(node.path);
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

  return (
    <div className="files-panel">
      <div className="files-panel-toolbar">
        <div className="files-panel-meta">
          <strong>Files</strong>
          <span className="mono dim" title={root}>
            {root ? root.replace(/.*\//, '…/') : '…'}
          </span>
        </div>
        <button type="button" className="icon-btn" onClick={() => void refresh()} title="Refresh">
          <RefreshCw size={14} className={loading ? 'spin' : undefined} />
        </button>
      </div>
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
          {content ? (
            <pre className="files-preview-code">{content}</pre>
          ) : (
            <p className="muted pad-sm">Select a file to preview</p>
          )}
        </div>
      </div>
    </div>
  );
}
