import React, { useState, useEffect } from 'react';
import { Play, DollarSign } from 'lucide-react';
import { Panel, Button, Badge, Field, SectionTitle, ListItem } from '../design/ui.jsx';

function EvaluatorView() {
  const [evals, setEvals] = useState([]);
  const [selectedEvalId, setSelectedEvalId] = useState('');
  const [selectedEval, setSelectedEval] = useState(null);

  const [evalName, setEvalName] = useState('AI Ethics Policy Test');
  const [topic, setTopic] = useState('Should AI systems be allowed to draft judicial sentencing recommendations?');
  const [maxRounds, setMaxRounds] = useState(3);
  const [runs, setRuns] = useState(3);
  const [debaterModel, setDebaterModel] = useState('gemini-2.5-flash');
  const [judgeModel, setJudgeModel] = useState('gemini-2.5-pro');
  const [isRunning, setIsRunning] = useState(false);
  const [statusLog, setStatusLog] = useState('');

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
      setSelectedEval(evals.find((e) => e.id === selectedEvalId) || null);
    }
  }, [selectedEvalId, evals]);

  const handleStartEval = async () => {
    setIsRunning(true);
    setStatusLog('Starting batch evaluation runs in background...');
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

      if (!res.ok) throw new Error('Failed to start evaluation run.');

      setStatusLog('Batch jobs submitted. Refreshing dashboard...');
      setTimeout(async () => {
        await fetchEvals();
        setIsRunning(false);
        setStatusLog('');
      }, 5000);
    } catch (e) {
      setStatusLog(`Error: ${e.message}`);
      setIsRunning(false);
    }
  };

  const results = selectedEval?.results;

  return (
    <div className="dashboard-grid">
      <Panel as="aside" pad="md" scroll className="stack">
        <div>
          <SectionTitle>Batch Eval Setup</SectionTitle>
          <div className="stack">
            <Field label="Evaluation Name">
              <input type="text" value={evalName} onChange={(e) => setEvalName(e.target.value)} />
            </Field>
            <Field label="Test Topic">
              <textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={3} />
            </Field>
            <div className="field-row">
              <Field label="Rounds" className="flex-1">
                <select value={maxRounds} onChange={(e) => setMaxRounds(parseInt(e.target.value, 10))}>
                  <option value={3}>3 Rounds</option>
                  <option value={4}>4 Rounds</option>
                </select>
              </Field>
              <Field label="Run Count" className="flex-1">
                <select value={runs} onChange={(e) => setRuns(parseInt(e.target.value, 10))}>
                  <option value={2}>2 Runs</option>
                  <option value={3}>3 Runs</option>
                  <option value={5}>5 Runs</option>
                </select>
              </Field>
            </div>
            <Field label="Model Config">
              <select value={debaterModel} onChange={(e) => setDebaterModel(e.target.value)}>
                <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                <option value="gemini-2.5-pro">gemini-2.5-pro</option>
              </select>
            </Field>
          </div>
        </div>

        <Button variant="brand" block onClick={handleStartEval} disabled={isRunning} style={{ marginTop: 'auto' }}>
          <Play size={16} />
          {isRunning ? 'Simulating...' : 'Start Batch Evals'}
        </Button>

        {evals.length > 0 && (
          <div>
            <SectionTitle muted>Completed Evals</SectionTitle>
            <div className="list-scroll">
              {evals.map((e) => (
                <ListItem
                  key={e.id}
                  active={e.id === selectedEvalId}
                  onClick={() => setSelectedEvalId(e.id)}
                  title={e.name}
                >
                  {e.name} ({e.runs} runs)
                </ListItem>
              ))}
            </div>
          </div>
        )}
      </Panel>

      <section className="view-content">
        {statusLog && <div className="status-log status-log--accent">{statusLog}</div>}

        {selectedEval && results ? (
          <div className="stack-lg">
            <Panel pad="md">
              <div className="row-between">
                <h2 style={{ fontSize: '1.25rem' }}>{selectedEval.name}</h2>
                <Badge tone="active">ID: {selectedEval.id}</Badge>
              </div>
              <p className="mt-2" style={{ fontSize: '0.85rem' }}>
                <strong className="text-secondary">Evaluated Topic:</strong> {selectedEval.topic}
              </p>
            </Panel>

            <div className="grid-3">
              <Panel pad="md">
                <span className="section-kicker">Win-Rate (Debater / Challenger)</span>
                <h3 className="text-success mt-1" style={{ fontSize: '1.5rem' }}>
                  {(results.winRatio?.debater * 100).toFixed(0)}% / {(results.winRatio?.challenger * 100).toFixed(0)}%
                </h3>
              </Panel>
              <Panel pad="md">
                <span className="section-kicker">Average Run Cost</span>
                <h3 className="row mt-1 text-primary" style={{ fontSize: '1.5rem' }}>
                  <DollarSign size={18} className="text-success" />
                  {results.averages?.costUsd?.toFixed(5)}
                </h3>
              </Panel>
              <Panel pad="md">
                <span className="section-kicker">Score Gap Consistency (Std Dev)</span>
                <h3 className="text-judge mt-1" style={{ fontSize: '1.5rem' }}>
                  ± {results.metricsConsistency?.scoreGapStandardDeviation || 0} pts
                </h3>
              </Panel>
            </div>

            <Panel pad="md" fill scroll>
              <h3 className="mb-4" style={{ fontSize: '0.95rem' }}>
                Trial Runs Metrics Breakdown
              </h3>
              <div className="stack">
                {results.runs.map((r, idx) => (
                  <div key={idx} className="list-item row-between" style={{ whiteSpace: 'normal', padding: '0.75rem' }}>
                    <div>
                      <span className="section-kicker" style={{ display: 'block' }}>
                        RUN {idx + 1}
                      </span>
                      <span className="text-primary" style={{ fontWeight: 510 }}>
                        Winner: {r.winner}
                      </span>
                    </div>
                    <div className="row" style={{ gap: '1.5rem', fontSize: '0.8rem' }}>
                      <div>
                        <span className="text-debater">Debater: </span>
                        <span className="mono">{r.scores?.debater?.total || 80}</span>
                      </div>
                      <div>
                        <span className="text-challenger">Challenger: </span>
                        <span className="mono">{r.scores?.challenger?.total || 80}</span>
                      </div>
                    </div>
                    <div className="mono text-quaternary" style={{ fontSize: '0.75rem' }}>
                      Cost: ${r.metrics?.totalCost?.toFixed(5)}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        ) : (
          <Panel fill>
            <div className="empty-state">
              No evaluation run selected. Launch a batch run or pick a completed trial.
            </div>
          </Panel>
        )}
      </section>
    </div>
  );
}

export default EvaluatorView;
