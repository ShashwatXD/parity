import React, { useState, useEffect } from 'react';
import { BarChart3, Coins, Clock, Database, AlertCircle } from 'lucide-react';
import { Panel, Field, MetricCard } from '../design/ui.jsx';

function ObservabilityView({ sessions }) {
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [sessionData, setSessionData] = useState(null);

  const fetchSessionDetails = async (id) => {
    if (!id) {
      setSessionData(null);
      return;
    }
    try {
      const res = await fetch(`/api/debate/${id}`);
      if (res.ok) {
        setSessionData(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (selectedSessionId) {
      fetchSessionDetails(selectedSessionId);
    } else if (sessions.length > 0) {
      setSelectedSessionId(sessions[0].id);
    }
  }, [selectedSessionId, sessions]);

  const messages = sessionData?.messages || [];
  const sessionPromptTokens = messages.reduce(
    (acc, m) => acc + (m.tokens_prompt || m.metrics?.promptTokens || 0),
    0
  );
  const sessionCompletionTokens = messages.reduce(
    (acc, m) => acc + (m.tokens_completion || m.metrics?.completionTokens || 0),
    0
  );
  const sessionTotalTokens = sessionPromptTokens + sessionCompletionTokens;
  const sessionCost = messages.reduce((acc, m) => acc + (m.cost_usd || m.metrics?.costUsd || 0), 0);
  const sessionAvgLatency =
    messages.length > 0
      ? messages.reduce((acc, m) => acc + (m.latency_ms || m.metrics?.latencyMs || 0), 0) / messages.length
      : 0;
  const maxLatency = Math.max(...messages.map((m) => m.latency_ms || m.metrics?.latencyMs || 0), 1000);

  const barColorFor = (sender) => {
    if (sender === 'debater') return 'var(--agent-debater)';
    if (sender === 'challenger') return 'var(--agent-challenger)';
    if (sender === 'fact_checker') return 'var(--agent-fact-checker)';
    if (sender === 'judge') return 'var(--agent-judge)';
    return 'var(--brand)';
  };

  return (
    <div className="view-content stack-lg">
      <Panel pad="sm" className="row-between">
        <div>
          <h3 style={{ fontSize: '1.125rem' }}>Observability Insights</h3>
          <p className="section-desc">Audit token usage, USD cost, and response latency</p>
        </div>
        <Field label="Select Session">
          <select value={selectedSessionId} onChange={(e) => setSelectedSessionId(e.target.value)}>
            <option value="">— Choose a run —</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                Round {s.rounds} | {s.topic.substring(0, 40)}...
              </option>
            ))}
          </select>
        </Field>
      </Panel>

      {sessionData ? (
        <div className="stack-lg">
          <div className="grid-4">
            <MetricCard icon={<Coins size={20} />} label="Cumulative Cost" value={`$${sessionCost.toFixed(5)}`} />
            <MetricCard
              icon={<Database size={20} />}
              label="Total Tokens"
              value={sessionTotalTokens.toLocaleString()}
            />
            <MetricCard
              icon={<Clock size={20} />}
              label="Avg Latency"
              value={`${sessionAvgLatency.toFixed(0)} ms`}
            />
            <MetricCard icon={<BarChart3 size={20} />} label="Messages Logged" value={`${messages.length} turns`} />
          </div>

          <div className="grid-2" style={{ flex: 1, minHeight: 0 }}>
            <Panel pad="md" className="stack" style={{ minHeight: 0 }}>
              <h3 className="row mb-3" style={{ fontSize: '0.95rem' }}>
                <Clock size={16} className="text-success" />
                Round latency profile (ms)
              </h3>

              {messages.length === 0 ? (
                <div className="empty-state text-quaternary" style={{ fontSize: '0.85rem' }}>
                  No messages logged in this session
                </div>
              ) : (
                <div
                  className="row-between"
                  style={{
                    alignItems: 'flex-end',
                    height: 180,
                    borderBottom: '1px solid var(--border-standard)',
                    paddingBottom: 8
                  }}
                >
                  {messages.map((m, index) => {
                    const lat = m.latency_ms || m.metrics?.latencyMs || 0;
                    const heightPercent = Math.min((lat / maxLatency) * 100, 100);
                    return (
                      <div
                        key={m.id || index}
                        className="stack-sm"
                        style={{ flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' }}
                      >
                        <span className="mono" style={{ fontSize: '0.65rem' }}>
                          {lat > 0 ? `${(lat / 1000).toFixed(1)}s` : '—'}
                        </span>
                        <div
                          title={`${m.sender} latency: ${lat}ms`}
                          style={{
                            width: '100%',
                            height: `${heightPercent}%`,
                            background: barColorFor(m.sender),
                            borderRadius: '3px 3px 0 0',
                            minHeight: 4,
                            opacity: 0.85
                          }}
                        />
                        <span className="mono text-quaternary" style={{ fontSize: '0.6rem', textTransform: 'uppercase' }}>
                          R{m.round}_{m.sender.substring(0, 3)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>

            <Panel pad="md" className="stack" style={{ minHeight: 0 }}>
              <h3 className="row mb-3" style={{ fontSize: '0.95rem' }}>
                <Database size={16} className="text-brand" />
                Token breakdown (Prompt vs Completion)
              </h3>

              {sessionTotalTokens === 0 ? (
                <div className="empty-state text-quaternary" style={{ fontSize: '0.85rem' }}>
                  No token records generated yet
                </div>
              ) : (
                <div className="stack" style={{ justifyContent: 'center', flex: 1 }}>
                  <div className="row-between" style={{ fontSize: '0.8rem' }}>
                    <span>Input: {sessionPromptTokens.toLocaleString()}</span>
                    <span>Output: {sessionCompletionTokens.toLocaleString()}</span>
                  </div>
                  <div
                    className="row"
                    style={{
                      height: 24,
                      borderRadius: 6,
                      overflow: 'hidden',
                      border: '1px solid var(--border-subtle)',
                      gap: 0
                    }}
                  >
                    <div
                      className="mono"
                      style={{
                        width: `${(sessionPromptTokens / sessionTotalTokens) * 100}%`,
                        background: 'var(--brand)',
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: '0.65rem',
                        color: '#fff'
                      }}
                    >
                      {((sessionPromptTokens / sessionTotalTokens) * 100).toFixed(0)}%
                    </div>
                    <div
                      className="mono"
                      style={{
                        width: `${(sessionCompletionTokens / sessionTotalTokens) * 100}%`,
                        background: 'var(--status-emerald)',
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: '0.65rem',
                        color: '#fff'
                      }}
                    >
                      {((sessionCompletionTokens / sessionTotalTokens) * 100).toFixed(0)}%
                    </div>
                  </div>
                  <p className="section-desc">
                    <AlertCircle size={14} className="text-brand" style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    Context compression runs automatically when token count exceeds system limits.
                  </p>
                </div>
              )}
            </Panel>
          </div>

          <Panel pad="md">
            <h3 className="mb-3" style={{ fontSize: '0.95rem' }}>
              Routing Costs & Rates (1M Tokens)
            </h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Routed Model</th>
                  <th>Input Cost (USD)</th>
                  <th>Output Cost (USD)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="text-debater" style={{ fontWeight: 590 }}>
                    Debater / Challenger
                  </td>
                  <td>gemini-2.5-flash</td>
                  <td>$0.075</td>
                  <td>$0.30</td>
                </tr>
                <tr>
                  <td className="text-judge" style={{ fontWeight: 590 }}>
                    Judge / Verdict Panel
                  </td>
                  <td>gemini-2.5-pro</td>
                  <td>$1.250</td>
                  <td>$5.00</td>
                </tr>
                <tr>
                  <td className="text-quaternary">Simulation (Offline)</td>
                  <td>simulation-model</td>
                  <td>$0.050</td>
                  <td>$0.15</td>
                </tr>
              </tbody>
            </table>
          </Panel>
        </div>
      ) : (
        <Panel fill>
          <div className="empty-state">
            No session selected. Launch a debate or pick a run from history.
          </div>
        </Panel>
      )}
    </div>
  );
}

export default ObservabilityView;
