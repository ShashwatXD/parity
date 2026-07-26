import React, { useState, useEffect } from 'react';
import { BarChart3, Coins, Clock, Database, AlertCircle } from 'lucide-react';

function ObservabilityView({ sessions }) {
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [sessionData, setSessionData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Fetch specific session metrics
  const fetchSessionDetails = async (id) => {
    if (!id) {
      setSessionData(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/debate/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSessionData(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedSessionId) {
      fetchSessionDetails(selectedSessionId);
    } else if (sessions.length > 0) {
      setSelectedSessionId(sessions[0].id);
    }
  }, [selectedSessionId, sessions]);

  // Aggregate global stats from sessions
  const totalCost = sessions.reduce((acc, s) => {
    // If completed and has verdict, compute estimated cost
    return acc + (s.verdict ? 0.0012 : 0.0004); // simplified fallbacks if no messages fetched yet
  }, 0);

  // Get active session messages metrics
  const messages = sessionData?.messages || [];
  const sessionPromptTokens = messages.reduce((acc, m) => acc + (m.tokens_prompt || m.metrics?.promptTokens || 0), 0);
  const sessionCompletionTokens = messages.reduce((acc, m) => acc + (m.tokens_completion || m.metrics?.completionTokens || 0), 0);
  const sessionTotalTokens = sessionPromptTokens + sessionCompletionTokens;
  const sessionCost = messages.reduce((acc, m) => acc + (m.cost_usd || m.metrics?.costUsd || 0), 0);
  const sessionAvgLatency = messages.length > 0 
    ? (messages.reduce((acc, m) => acc + (m.latency_ms || m.metrics?.latencyMs || 0), 0) / messages.length) 
    : 0;

  // Max latency for scaling charts
  const maxLatency = Math.max(...messages.map(m => m.latency_ms || m.metrics?.latencyMs || 0), 1000);

  return (
    <div className="view-content" style={{ gap: '1.5rem' }}>
      
      {/* Session Selection Header */}
      <div className="glass-panel" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3>Observability Insights</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-dark)' }}>Audit token usage, USD expenditures, and network response latencies</p>
        </div>
        
        <div>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginRight: '0.5rem' }}>Select Session:</label>
          <select 
            value={selectedSessionId} 
            onChange={(e) => setSelectedSessionId(e.target.value)}
            style={{ fontSize: '0.85rem' }}
          >
            <option value="">-- Choose active or historical run --</option>
            {sessions.map(s => (
              <option key={s.id} value={s.id}>
                Round {s.rounds} | {s.topic.substring(0, 40)}...
              </option>
            ))}
          </select>
        </div>
      </div>

      {sessionData ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1, minHeight: 0 }}>
          
          {/* Key Metric Highlight Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
            
            <div className="glass-panel" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ background: 'rgba(99,102,241,0.1)', padding: '0.5rem', borderRadius: '8px', color: 'var(--primary)' }}>
                <Coins size={24} />
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cumulative Cost</span>
                <h4 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-mono)' }}>${sessionCost.toFixed(5)}</h4>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ background: 'rgba(20,184,166,0.1)', padding: '0.5rem', borderRadius: '8px', color: 'var(--accent)' }}>
                <Database size={24} />
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Tokens</span>
                <h4 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-mono)' }}>{sessionTotalTokens.toLocaleString()}</h4>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ background: 'rgba(245,158,11,0.1)', padding: '0.5rem', borderRadius: '8px', color: 'var(--color-fact-checker)' }}>
                <Clock size={24} />
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Avg Latency</span>
                <h4 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-mono)' }}>{sessionAvgLatency.toFixed(0)} ms</h4>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ background: 'rgba(168,85,247,0.1)', padding: '0.5rem', borderRadius: '8px', color: 'var(--color-judge)' }}>
                <BarChart3 size={24} />
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Messages Logged</span>
                <h4 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-mono)' }}>{messages.length} turns</h4>
              </div>
            </div>
          </div>

          {/* Graph Section */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', flex: 1, minHeight: 0 }}>
            
            {/* Custom SVG Latency Distribution */}
            <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <h3 style={{ fontSize: '0.95rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={16} color="var(--accent)" />
                Round latency profile (ms)
              </h3>
              
              {messages.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dark)', fontSize: '0.85rem' }}>
                  No messages logged in this session
                </div>
              ) : (
                <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem', height: '180px' }}>
                  {messages.map((m, index) => {
                    const lat = m.latency_ms || m.metrics?.latencyMs || 0;
                    const heightPercent = Math.min((lat / maxLatency) * 100, 100);
                    
                    let barColor = 'var(--primary)';
                    if (m.sender === 'debater') barColor = 'var(--color-debater)';
                    if (m.sender === 'challenger') barColor = 'var(--color-challenger)';
                    if (m.sender === 'fact_checker') barColor = 'var(--color-fact-checker)';
                    if (m.sender === 'judge') barColor = 'var(--color-judge)';

                    return (
                      <div 
                        key={m.id || index} 
                        style={{ 
                          flex: 1, 
                          display: 'flex', 
                          flexDirection: 'column', 
                          alignItems: 'center', 
                          height: '100%', 
                          justifyContent: 'flex-end' 
                        }}
                      >
                        <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', marginBottom: '0.25rem' }}>
                          {lat > 0 ? `${(lat/1000).toFixed(1)}s` : '-'}
                        </span>
                        <div 
                          style={{ 
                            width: '100%', 
                            height: `${heightPercent}%`, 
                            background: barColor, 
                            borderRadius: '3px 3px 0 0',
                            minHeight: '4px',
                            transition: 'height 0.5s ease-out',
                            opacity: 0.8
                          }}
                          title={`${m.sender} latency: ${lat}ms`}
                        />
                        <span style={{ fontSize: '0.6rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginTop: '0.5rem', color: 'var(--text-dark)' }}>
                          R{m.round}_{m.sender.substring(0, 3)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Custom SVG Token Distribution */}
            <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <h3 style={{ fontSize: '0.95rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Database size={16} color="var(--primary)" />
                Token breakdown (Prompt vs Completion)
              </h3>

              {sessionTotalTokens === 0 ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dark)', fontSize: '0.85rem' }}>
                  No token records generated yet
                </div>
              ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1.25rem' }}>
                  
                  {/* Visual Stacked bar */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                      <span>Input Context: {sessionPromptTokens.toLocaleString()} tokens</span>
                      <span>Output Context: {sessionCompletionTokens.toLocaleString()} tokens</span>
                    </div>
                    
                    <div style={{ display: 'flex', height: '24px', borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div 
                        style={{ 
                          width: `${(sessionPromptTokens / sessionTotalTokens) * 100}%`, 
                          background: 'var(--primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.65rem',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 'bold',
                          color: '#fff'
                        }}
                      >
                        {((sessionPromptTokens / sessionTotalTokens) * 100).toFixed(0)}%
                      </div>
                      <div 
                        style={{ 
                          width: `${(sessionCompletionTokens / sessionTotalTokens) * 100}%`, 
                          background: 'var(--accent)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.65rem',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 'bold',
                          color: '#fff'
                        }}
                      >
                        {((sessionCompletionTokens / sessionTotalTokens) * 100).toFixed(0)}%
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                    <AlertCircle size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle', color: 'var(--primary)' }} />
                    Context compression operates automatically when the total token count exceeds system limits, preventing context-window errors during long debates.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Model Routing Price Sheets */}
          <div className="glass-panel" style={{ padding: '1rem 1.25rem' }}>
            <h3 style={{ fontSize: '0.95rem', marginBottom: '0.75rem' }}>Routing Costs & Rates Sheet (1M Tokens)</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-dark)', textAlign: 'left' }}>
                  <th style={{ padding: '6px 0' }}>Role</th>
                  <th>Routed Model</th>
                  <th>Input Cost (USD)</th>
                  <th>Output Cost (USD)</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <td style={{ padding: '6px 0', color: 'var(--color-debater)', fontWeight: 'bold' }}>Debater / Challenger</td>
                  <td>gemini-2.5-flash</td>
                  <td>$0.075</td>
                  <td>$0.30</td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <td style={{ padding: '6px 0', color: 'var(--color-judge)', fontWeight: 'bold' }}>Judge / Verdict Panel</td>
                  <td>gemini-2.5-pro</td>
                  <td>$1.250</td>
                  <td>$5.00</td>
                </tr>
                <tr>
                  <td style={{ padding: '6px 0', color: 'var(--text-dark)' }}>Simulation (Offline)</td>
                  <td>simulation-model</td>
                  <td>$0.050</td>
                  <td>$0.15</td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>
      ) : (
        <div className="glass-panel" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          No session selected. Please launch a debate or select a run from history to view metrics.
        </div>
      )}
    </div>
  );
}

export default ObservabilityView;
