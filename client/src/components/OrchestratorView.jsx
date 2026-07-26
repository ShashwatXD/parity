import React, { useState, useEffect, useRef } from 'react';
import { Send, RefreshCw, Cpu, Brain, User, Sparkles, AlertTriangle } from 'lucide-react';
import {
  Panel,
  Button,
  Badge,
  Field,
  SectionTitle,
  EmptyState,
  ListItem,
  AgentNode
} from '../design/ui.jsx';

function OrchestratorView({ sessions, onDebateCreated }) {
  const [topic, setTopic] = useState(
    'Should corporate entities be allowed to deploy autonomous AI agents with decision-making power over employee layoffs?'
  );
  const [maxRounds, setMaxRounds] = useState(3);
  const [debaterModel, setDebaterModel] = useState('gemini-2.5-flash');
  const [challengerModel, setChallengerModel] = useState('gemini-2.5-flash');
  const [factCheckerModel, setFactCheckerModel] = useState('gemini-2.5-flash');
  const [judgeModel, setJudgeModel] = useState('gemini-2.5-pro');
  const [enableFactChecker, setEnableFactChecker] = useState(true);
  const [enableSelfCritique, setEnableSelfCritique] = useState(true);
  const [hitlInterval, setHitlInterval] = useState('none');

  const [ragFilename, setRagFilename] = useState('ethical_principles.txt');
  const [ragContent, setRagContent] = useState(
    'Autonomous HR safety protocol (2025): Section 4 states that all critical staff layoffs must undergo standard human review. AI models must act strictly in advisory roles. System models may suffer from feedback loops, and token compression errors can omit key human variables.'
  );

  const [activeSessionId, setActiveSessionId] = useState('');
  const [sessionDetails, setSessionDetails] = useState(null);
  const [messages, setMessages] = useState([]);
  const [activeAgent, setActiveAgent] = useState('');
  const [agentState, setAgentState] = useState('');
  const [statusLog, setStatusLog] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [humanInput, setHumanInput] = useState('');
  const [isStarting, setIsStarting] = useState(false);

  const socketRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, statusLog]);

  useEffect(() => {
    if (!activeSessionId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?sessionId=${activeSessionId}`;
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      setStatusLog('Connected to orchestrator engine lobby...');
      setIsPaused(false);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'status_update':
          setStatusLog(data.text);
          break;
        case 'agent_status':
          setActiveAgent(data.agent);
          setAgentState(data.status);
          setStatusLog(`${data.agent.toUpperCase()} is currently ${data.status}...`);
          break;
        case 'message_added':
          setMessages((prev) => {
            if (prev.some((m) => m.id === data.message.id)) return prev;
            return [...prev, data.message];
          });
          setActiveAgent('');
          setAgentState('');
          setStatusLog('');
          break;
        case 'hitl_pause':
          setIsPaused(true);
          setActiveAgent('');
          setAgentState('');
          setStatusLog(`Paused at round ${data.round} boundary for human injection.`);
          break;
        case 'context_compressed':
          setStatusLog('Context window compressed! Summarized older rounds.');
          break;
        case 'debate_completed':
          setSessionDetails((prev) => ({
            ...prev,
            status: 'completed',
            verdict: data.verdict
          }));
          setActiveAgent('');
          setAgentState('');
          setStatusLog('Debate complete! Verdict rendered.');
          break;
        case 'agent_error':
          setStatusLog(`Error from agent ${data.agent}: ${data.message}`);
          setActiveAgent('');
          setAgentState('');
          break;
        default:
          break;
      }
    };

    return () => {
      if (ws) ws.close();
    };
  }, [activeSessionId]);

  const loadDebateDetails = async (id) => {
    try {
      const res = await fetch(`/api/debate/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSessionDetails(data);
        setMessages(data.messages || []);
        setActiveSessionId(data.status === 'active' || data.status === 'paused' ? id : '');
        setIsPaused(data.status === 'paused');
        setStatusLog(data.status === 'completed' ? 'Verdict loaded.' : '');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleLaunch = async () => {
    setIsStarting(true);
    setMessages([]);
    setSessionDetails(null);
    setActiveAgent('');
    setAgentState('');
    setStatusLog('Initializing engine...');

    try {
      const res = await fetch('/api/debate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          maxRounds,
          config: {
            debaterModel,
            challengerModel,
            factCheckerModel,
            judgeModel,
            enableFactChecker,
            enableSelfCritique,
            hitlInterval
          }
        })
      });

      if (!res.ok) throw new Error('Failed to create session');

      const data = await res.json();
      setActiveSessionId(data.sessionId);
      setSessionDetails({
        id: data.sessionId,
        topic,
        rounds: maxRounds,
        status: 'active'
      });

      if (ragContent && ragContent.trim()) {
        await fetch(`/api/debate/${data.sessionId}/grounding`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: ragFilename, text: ragContent })
        });
      }

      onDebateCreated();
    } catch (e) {
      setStatusLog(`Error: ${e.message}`);
    } finally {
      setIsStarting(false);
    }
  };

  const handleInjectComment = async () => {
    if (!humanInput.trim()) return;
    setIsPaused(false);
    const comment = humanInput;
    setHumanInput('');
    setStatusLog('Injecting user context and resuming turn-scheduler...');

    try {
      await fetch(`/api/debate/${activeSessionId}/inject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment })
      });
    } catch (e) {
      console.error(e);
      setStatusLog('Failed to submit human commentary.');
      setIsPaused(true);
    }
  };

  return (
    <div className="dashboard-grid">
      <Panel as="aside" pad="md" scroll className="stack">
        <div>
          <SectionTitle>Session Settings</SectionTitle>
          <div className="stack">
            <Field label="Debate Topic">
              <textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={3} />
            </Field>

            <div className="field-row">
              <Field label="Rounds" className="flex-1">
                <select value={maxRounds} onChange={(e) => setMaxRounds(parseInt(e.target.value, 10))}>
                  <option value={3}>3 Rounds</option>
                  <option value={4}>4 Rounds</option>
                  <option value={5}>5 Rounds</option>
                </select>
              </Field>
              <Field label="HITL Intercept" className="flex-1">
                <select value={hitlInterval} onChange={(e) => setHitlInterval(e.target.value)}>
                  <option value="none">None</option>
                  <option value="every_round">Every Round</option>
                </select>
              </Field>
            </div>
          </div>
        </div>

        <div>
          <SectionTitle>Model Routing</SectionTitle>
          <div className="stack-sm">
            <Field label="Debaters (Flash)">
              <select
                className="control-sm"
                value={debaterModel}
                onChange={(e) => {
                  setDebaterModel(e.target.value);
                  setChallengerModel(e.target.value);
                }}
              >
                <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                <option value="gemini-2.5-pro">gemini-2.5-pro</option>
              </select>
            </Field>
            <Field label="Evaluator / Judge (Pro)">
              <select className="control-sm" value={judgeModel} onChange={(e) => setJudgeModel(e.target.value)}>
                <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                <option value="gemini-2.5-flash">gemini-2.5-flash</option>
              </select>
            </Field>
            <label className="field-check">
              <input type="checkbox" checked={enableFactChecker} onChange={(e) => setEnableFactChecker(e.target.checked)} />
              Fact Checker Agent
            </label>
            <label className="field-check">
              <input
                type="checkbox"
                checked={enableSelfCritique}
                onChange={(e) => setEnableSelfCritique(e.target.checked)}
              />
              Agent Self-Critique turn
            </label>
          </div>
        </div>

        <div>
          <SectionTitle>RAG Grounding Document</SectionTitle>
          <div className="stack-sm">
            <input
              type="text"
              className="control-sm"
              placeholder="Filename (e.g. guide.txt)"
              value={ragFilename}
              onChange={(e) => setRagFilename(e.target.value)}
            />
            <textarea
              className="control-sm"
              placeholder="Grounding reference text..."
              value={ragContent}
              onChange={(e) => setRagContent(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <Button variant="brand" block onClick={handleLaunch} disabled={isStarting || !!activeSessionId} style={{ marginTop: 'auto' }}>
          <Sparkles size={16} />
          {isStarting ? 'Spawning...' : 'Launch Simulator'}
        </Button>

        {sessions.length > 0 && (
          <div>
            <SectionTitle muted>Historical Sessions</SectionTitle>
            <div className="list-scroll">
              {sessions.map((s) => (
                <ListItem
                  key={s.id}
                  active={s.id === sessionDetails?.id}
                  onClick={() => loadDebateDetails(s.id)}
                  title={s.topic}
                >
                  {s.topic}
                </ListItem>
              ))}
            </div>
          </div>
        )}
      </Panel>

      <section className="view-content">
        {sessionDetails ? (
          <div className="stack-lg">
            <Panel pad={false} className="agent-pipeline">
              <AgentNode role="debater" label="Debater" active={activeAgent === 'debater'} state={agentState}>
                <Brain size={18} />
              </AgentNode>
              <span className="agent-pipe">→</span>
              <AgentNode role="challenger" label="Challenger" active={activeAgent === 'challenger'} state={agentState}>
                <Cpu size={18} />
              </AgentNode>
              <span className="agent-pipe">→</span>
              <AgentNode
                role="fact_checker"
                label="Fact Checker"
                active={activeAgent === 'fact_checker'}
                state={agentState}
              >
                <Sparkles size={18} />
              </AgentNode>
              <span className="agent-pipe">→</span>
              <AgentNode role="judge" label="Judge" active={activeAgent === 'judge'} state={agentState}>
                <User size={18} />
              </AgentNode>
            </Panel>

            <Panel pad="md" fill scroll className="stack" ref={scrollRef}>
              <div className="mb-2" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
                <Badge tone="active">Session: {sessionDetails.id}</Badge>
                <h2 className="mt-2" style={{ fontSize: '1.125rem' }}>
                  {sessionDetails.topic}
                </h2>
              </div>

              {messages.length === 0 && !statusLog && (
                <EmptyState icon={<Brain size={28} />} body="Waiting for debate sequence to initialize..." />
              )}

              {messages.map((m) => (
                <div key={m.id || `${m.sender}-${m.round}`} className={`message message--${m.sender} animate-slide-up`}>
                  <div className="row-between">
                    <div className="row">
                      <Badge tone={m.sender}>{m.sender.toUpperCase()}</Badge>
                      <span className="message__meta">Round {m.round}</span>
                    </div>
                    {m.metrics && m.metrics.totalTokens > 0 && (
                      <div className="message__metrics">
                        <span>Latency: {m.metrics.latencyMs}ms</span>
                        <span>Tokens: {m.metrics.totalTokens}</span>
                        <span className="text-success">Cost: ${m.metrics.costUsd?.toFixed(5)}</span>
                      </div>
                    )}
                  </div>
                  <p className="message__body">{m.content}</p>
                </div>
              ))}

              {statusLog && (
                <div className="status-log">
                  <RefreshCw size={14} className="animate-float" />
                  {statusLog}
                </div>
              )}
            </Panel>

            {isPaused && (
              <Panel variant="hitl" pad="md" className="stack animate-slide-up">
                <div className="row text-success">
                  <AlertTriangle size={18} />
                  <h4 className="text-success" style={{ fontSize: '0.9rem' }}>
                    Human-in-the-Loop Intervention Required
                  </h4>
                </div>
                <p style={{ fontSize: '0.8125rem' }}>
                  The debate has paused at a round boundary. Inject comments, critiques, or facts to guide the agents.
                </p>
                <div className="row">
                  <input
                    type="text"
                    className="flex-1"
                    placeholder="Type feedback for the agents..."
                    value={humanInput}
                    onChange={(e) => setHumanInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleInjectComment()}
                  />
                  <Button variant="success" icon onClick={handleInjectComment}>
                    <Send size={16} />
                  </Button>
                </div>
              </Panel>
            )}

            {sessionDetails.verdict && (
              <Panel variant="verdict" pad="md" className="animate-slide-up">
                <h3 className="text-judge mb-3" style={{ fontSize: '1.05rem' }}>
                  Judge Final Verdict: Winner declared {sessionDetails.verdict.winner}
                </h3>

                <div className="grid-2 mb-4">
                  <div className="scorecard">
                    <h4 className="scorecard__title text-debater">Debater Scorecard</h4>
                    <div className="scorecard__grid">
                      <div>Rhetoric: {sessionDetails.verdict.scores?.debater?.rhetoric || 80}</div>
                      <div>Evidence: {sessionDetails.verdict.scores?.debater?.evidence || 80}</div>
                      <div>Rebuttals: {sessionDetails.verdict.scores?.debater?.rebuttals || 80}</div>
                    </div>
                    <div className="scorecard__total">
                      Overall: {sessionDetails.verdict.scores?.debater?.total || 80}
                    </div>
                  </div>

                  <div className="scorecard">
                    <h4 className="scorecard__title text-challenger">Challenger Scorecard</h4>
                    <div className="scorecard__grid">
                      <div>Rhetoric: {sessionDetails.verdict.scores?.challenger?.rhetoric || 80}</div>
                      <div>Evidence: {sessionDetails.verdict.scores?.challenger?.evidence || 80}</div>
                      <div>Rebuttals: {sessionDetails.verdict.scores?.challenger?.rebuttals || 80}</div>
                    </div>
                    <div className="scorecard__total">
                      Overall: {sessionDetails.verdict.scores?.challenger?.total || 80}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '0.85rem' }} className="text-tertiary">
                  <strong className="text-secondary">Judge Summary:</strong> {sessionDetails.verdict.summary}
                </div>
                {sessionDetails.verdict.recommendation && (
                  <div className="mt-2 text-quaternary" style={{ fontSize: '0.8rem' }}>
                    <strong>Recommendations:</strong> {sessionDetails.verdict.recommendation}
                  </div>
                )}
              </Panel>
            )}
          </div>
        ) : (
          <Panel fill>
            <EmptyState
              icon={<Brain size={40} className="animate-float" />}
              title="Debate Simulator Idle"
              body="Select a topic, configure multi-agent routing in the sidebar, and launch to begin the simulation."
            />
          </Panel>
        )}
      </section>
    </div>
  );
}

export default OrchestratorView;
