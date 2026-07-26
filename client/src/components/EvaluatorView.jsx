import React, { useState, useEffect } from 'react';
import { Binary, Play, HelpCircle, AlertCircle, TrendingUp, Sparkles, DollarSign } from 'lucide-react';

function EvaluatorView() {
  const [evals, setEvals] = useState([]);
  const [selectedEvalId, setSelectedEvalId] = useState("");
  const [selectedEval, setSelectedEval] = useState(null);

  // Form config
  const [evalName, setEvalName] = useState("AI Ethics Policy Test");
  const [topic, setTopic] = useState("Should AI systems be allowed to draft judicial sentencing recommendations?");
  const [maxRounds, setMaxRounds] = useState(3);
  const [runs, setRuns] = useState(3);
  const [debaterModel, setDebaterModel] = useState("gemini-2.5-flash");
  const [judgeModel, setJudgeModel] = useState("gemini-2.5-pro");
  const [isRunning, setIsRunning] = useState(false);
  const [statusLog, setStatusLog] = useState("");

  const fetchEvals = async () => {
    try {
      const res = await fetch('/api/evaluations');
      if (res.ok) {
        const data = await res.json();
        setEvals(data);
        if (data.length > 0 && !selectedEvalId) {
          setSelectedEvalId(data[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchEvals();
  }, []);

  useEffect(() => {
    if (selectedEvalId) {
      const found = evals.find(e => e.id === selectedEvalId);
      setSelectedEval(found || null);
    }
  }, [selectedEvalId, evals]);

  const handleStartEval = async () => {
    setIsRunning(true);
    setStatusLog("Starting batch evaluation runs in background...");
    try {
      const res = await fetch('/api/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: evalName,
          topic,
          maxRounds,
          runs,
          config: {
            debaterModel,
            challengerModel: debaterModel,
            factCheckerModel: 'gemini-2.5-flash',
            judgeModel,
            enableFactChecker: true
          }
        })
      });

      if (!res.ok) {
        throw new Error("Failed to start evaluation run.");
      }

      setStatusLog("Batch jobs submitted. Runs are simulating... Refreshing dashboard.");
      
      // Periodically check for completion
      setTimeout(async () => {
        await fetchEvals();
        setIsRunning(false);
        setStatusLog("");
      }, 5000);

    } catch (e) {
      setStatusLog(`Error: ${e.message}`);
      setIsRunning(false);
    }
  };

  const results = selectedEval?.results;

  return (
    <div className="dashboard-grid">
      
      {/* Configuration Sidebar */}
      <aside className="glass-panel" style={{ padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div>
          <h3 style={{ fontSize: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
            Batch Eval Setup
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Evaluation Name</label>
              <input 
                type="text" 
                value={evalName} 
                onChange={(e) => setEvalName(e.target.value)} 
                style={{ width: '100%', fontSize: '0.85rem' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Test Topic</label>
              <textarea 
                value={topic} 
                onChange={(e) => setTopic(e.target.value)} 
                rows={3}
                style={{ width: '100%', resize: 'none', fontSize: '0.85rem' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Rounds</label>
                <select value={maxRounds} onChange={(e) => setMaxRounds(parseInt(e.target.value))} style={{ width: '100%', fontSize: '0.85rem' }}>
                  <option value={3}>3 Rounds</option>
                  <option value={4}>4 Rounds</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Run Count (Trials)</label>
                <select value={runs} onChange={(e) => setRuns(parseInt(e.target.value))} style={{ width: '100%', fontSize: '0.85rem' }}>
                  <option value={2}>2 Runs</option>
                  <option value={3}>3 Runs</option>
                  <option value={5}>5 Runs</option>
                </select>
              </div>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Model Config</label>
              <select value={debaterModel} onChange={(e) => setDebaterModel(e.target.value)} style={{ width: '100%', fontSize: '0.85rem' }}>
                <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                <option value="gemini-2.5-pro">gemini-2.5-pro</option>
              </select>
            </div>
          </div>
        </div>

        <button 
          className="btn-primary" 
          onClick={handleStartEval} 
          disabled={isRunning}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: 'auto' }}
        >
          <Play size={16} />
          {isRunning ? "Simulating..." : "Start Batch Evals"}
        </button>

        {evals.length > 0 && (
          <div>
            <h3 style={{ fontSize: '0.85rem', color: 'var(--text-dark)', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.25rem', marginBottom: '0.5rem' }}>
              Completed Evals
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '180px', overflowY: 'auto' }}>
              {evals.map(e => (
                <div 
                  key={e.id} 
                  onClick={() => setSelectedEvalId(e.id)}
                  style={{ 
                    fontSize: '0.75rem', 
                    padding: '6px 8px', 
                    borderRadius: '4px', 
                    background: e.id === selectedEvalId ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)',
                    cursor: 'pointer',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    border: '1px solid rgba(255, 255, 255, 0.03)'
                  }}
                  title={e.name}
                >
                  📊 {e.name} ({e.runs} runs)
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>

      {/* Main Results View */}
      <section className="view-content" style={{ gap: '1.25rem' }}>
        {statusLog && (
          <div style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', padding: '0.5rem', background: 'rgba(20, 184, 166, 0.05)', border: '1px solid rgba(20, 184, 166, 0.2)', borderRadius: '6px' }}>
            {statusLog}
          </div>
        )}

        {selectedEval && results ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', flex: 1, minHeight: 0 }}>
            
            {/* Header Details */}
            <div className="glass-panel" style={{ padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '1.25rem' }}>{selectedEval.name}</h2>
                <span className="badge badge-active">ID: {selectedEval.id}</span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                <strong>Evaluated Topic:</strong> {selectedEval.topic}
              </p>
            </div>

            {/* Trial Aggregated Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
              <div className="glass-panel" style={{ padding: '1rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Win-Rate (Debater / Challenger)</span>
                <h3 style={{ fontSize: '1.5rem', marginTop: '0.25rem', color: 'var(--accent)' }}>
                  {(results.winRatio?.debater * 100).toFixed(0)}% / {(results.winRatio?.challenger * 100).toFixed(0)}%
                </h3>
              </div>
              
              <div className="glass-panel" style={{ padding: '1rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Average Run Cost</span>
                <h3 style={{ fontSize: '1.5rem', marginTop: '0.25rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <DollarSign size={18} color="var(--accent)" />
                  {results.averages?.costUsd?.toFixed(5)}
                </h3>
              </div>

              <div className="glass-panel" style={{ padding: '1rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Score Gap Consistency (Std Dev)</span>
                <h3 style={{ fontSize: '1.5rem', marginTop: '0.25rem', color: 'var(--color-judge)' }}>
                  ± {results.metricsConsistency?.scoreGapStandardDeviation || 0} pts
                </h3>
              </div>
            </div>

            {/* Visual comparisons */}
            <div className="glass-panel" style={{ padding: '1.25rem', flex: 1, overflowY: 'auto' }}>
              <h3 style={{ fontSize: '0.95rem', marginBottom: '1rem' }}>Trial Runs Metrics Breakdown</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {results.runs.map((r, idx) => (
                  <div 
                    key={idx} 
                    style={{ 
                      background: 'rgba(255,255,255,0.01)', 
                      border: '1px solid rgba(255,255,255,0.04)', 
                      borderRadius: '6px',
                      padding: '0.75rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-dark)', display: 'block' }}>RUN {idx + 1}</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Winner: {r.winner}</span>
                    </div>

                    <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.8rem' }}>
                      <div>
                        <span style={{ color: 'var(--color-debater)', marginRight: '4px' }}>Debater:</span>
                        <span style={{ fontFamily: 'var(--font-mono)' }}>{r.scores?.debater?.total || 80}</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--color-challenger)', marginRight: '4px' }}>Challenger:</span>
                        <span style={{ fontFamily: 'var(--font-mono)' }}>{r.scores?.challenger?.total || 80}</span>
                      </div>
                    </div>

                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-dark)' }}>
                      Cost: ${r.metrics?.totalCost?.toFixed(5)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        ) : (
          <div className="glass-panel" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            No evaluation run selected. Launch a batch run or select a completed trial from the sidebar.
          </div>
        )}
      </section>
    </div>
  );
}

export default EvaluatorView;
