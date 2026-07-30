'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Play, RefreshCw } from 'lucide-react';
import {
  workspaceRepository,
  type TerminalEntry,
} from '@/lib/api/repositories/workspaceRepository';

export function TerminalPanel() {
  const [history, setHistory] = useState<TerminalEntry[]>([]);
  const [command, setCommand] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [cwd, setCwd] = useState('');
  const scroller = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const [entries, root] = await Promise.all([
        workspaceRepository.history(50),
        workspaceRepository.root(),
      ]);
      setHistory(entries);
      setCwd(root.root);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [history]);

  async function run(e?: React.FormEvent) {
    e?.preventDefault();
    const cmd = command.trim();
    if (!cmd || running) return;
    setRunning(true);
    setError('');
    try {
      const entry = await workspaceRepository.run(cmd);
      setHistory((prev) => [...prev, entry]);
      setCommand('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="terminal-panel">
      <div className="files-panel-toolbar">
        <div className="files-panel-meta">
          <strong>Terminal</strong>
          <span className="mono dim" title={cwd}>
            {cwd ? cwd.replace(/.*\//, '…/') : 'workspace'}
          </span>
        </div>
        <button type="button" className="icon-btn" onClick={() => void refresh()} title="Refresh">
          <RefreshCw size={14} />
        </button>
      </div>
      {error ? <div className="files-panel-error">{error}</div> : null}
      <div className="terminal-scroll" ref={scroller}>
        {history.length === 0 ? (
          <p className="muted pad-sm">No commands yet. Run something below — the agent uses the same shell.</p>
        ) : (
          history.map((entry) => (
            <div key={entry.id} className="terminal-entry">
              <div className="terminal-cmd">
                <span className="terminal-prompt">$</span> {entry.command}
                <span className="mono dim" style={{ marginLeft: 8 }}>
                  exit {entry.exitCode ?? '?'} · {entry.durationMs}ms
                  {entry.timedOut ? ' · timed out' : ''}
                </span>
              </div>
              {entry.stdout ? <pre className="terminal-out">{entry.stdout}</pre> : null}
              {entry.stderr ? <pre className="terminal-err">{entry.stderr}</pre> : null}
            </div>
          ))
        )}
      </div>
      <form className="terminal-input-row" onSubmit={(e) => void run(e)}>
        <span className="terminal-prompt">$</span>
        <input
          className="terminal-input"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="ls -la"
          disabled={running}
          spellCheck={false}
          autoComplete="off"
        />
        <button type="submit" className="icon-btn" disabled={running || !command.trim()} title="Run">
          <Play size={14} />
        </button>
      </form>
    </div>
  );
}
