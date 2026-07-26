import React, { useState, useEffect, useRef } from 'react';
import { Send, Upload, RefreshCw, Cpu, Brain, User, AlertCircle, Sparkles, AlertTriangle } from 'lucide-react';

function OrchestratorView({ sessions, onDebateCreated }) {
  // Config states
  const [topic, setTopic] = useState("Should corporate entities be allowed to deploy autonomous AI agents with decision-making power over employee layoffs?");
  const [maxRounds, setMaxRounds] = useState(3);
  const [debaterModel, setDebaterModel] = useState("gemini-2.5-flash");
  const [challengerModel, setChallengerModel] = useState("gemini-2.5-flash");
  const [factCheckerModel, setFactCheckerModel] = useState("gemini-2.5-flash");
  const [judgeModel, setJudgeModel] = useState("gemini-2.5-pro");
  const [enableFactChecker, setEnableFactChecker] = useState(true);
  const [enableSelfCritique, setEnableSelfCritique] = useState(true);
  const [hitlInterval, setHitlInterval] = useState("none"); // "none", "every_round"

  // Grounding RAG state
  const [ragFilename, setRagFilename] = useState("ethical_principles.txt");
  const [ragContent, setRagContent] = useState("Autonomous HR safety protocol (2025): Section 4 states that all critical staff layoffs must undergo standard human review. AI models must act strictly in advisory roles. System models may suffer from feedback loops, and token compression errors can omit key human variables.");
  const [ragStatus, setRagStatus] = useState("");

  // Running states
  const [activeSessionId, setActiveSessionId] = useState("");
  const [sessionDetails, setSessionDetails] = useState(null);
  const [messages, setMessages] = useState([]);
  const [activeAgent, setActiveAgent] = useState(""); // "debater", "challenger", "fact_checker", "judge"
  const [agentState, setAgentState] = useState(""); // "thinking", "reflecting", "judging", "critiquing"
  const [statusLog, setStatusLog] = useState("");
  const [isPaused, setIsPaused] = useState(false);
  const [humanInput, setHumanInput] = useState("");
  const [isStarting, setIsStarting] = useState(false);

  const socketRef = useRef(null);
  const scrollRef = useRef(null);

  // Auto-scroll chat log
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, statusLog]);

  // Handle WebSocket updates
  useEffect(() => {
    if (!activeSessionId) return;

    // Connect to WebSocket proxy
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?sessionId=${activeSessionId}`;
    console.log("Connecting to WS:", wsUrl);

    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      setStatusLog("Connected to orchestrator engine lobby...");
      setIsPaused(false);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("WS Event received:", data);

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
          setMessages(prev => {
            // Avoid duplicate additions
            if (prev.some(m => m.id === data.message.id)) return prev;
            return [...prev, data.message];
          });
          setActiveAgent("");
          setAgentState("");
          setStatusLog("");
          break;
        case 'hitl_pause':
          setIsPaused(true);
          setActiveAgent("");
          setAgentState("");
          setStatusLog(`Paused at round ${data.round} boundary for human injection.`);
          break;
        case 'context_compressed':
          setStatusLog(`Context window compressed! Summarized older rounds.`);
          break;
        case 'debate_completed':
          setSessionDetails(prev => ({
            ...prev,
            status: 'completed',
            verdict: data.verdict
          }));
          setActiveAgent("");
          setAgentState("");
          setStatusLog("Debate complete! Verdict rendered.");
          break;
        case 'agent_error':
          setStatusLog(`Error from agent ${data.agent}: ${data.message}`);
          setActiveAgent("");
          setAgentState("");
          break;
      }
    };

    ws.onclose = () => {
      console.log("WebSocket connection closed.");
    };

    return () => {
      if (ws) ws.close();
    };
  }, [activeSessionId]);

  // Load an existing debate session from historical records
  const loadDebateDetails = async (id) => {
    try {
      const res = await fetch(`/api/debate/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSessionDetails(data);
        setMessages(data.messages || []);
        setActiveSessionId(data.status === 'active' || data.status === 'paused' ? id : "");
        setIsPaused(data.status === 'paused');
        setStatusLog(data.status === 'completed' ? "Verdict loaded." : "");
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Launch a new debate
  const handleLaunch = async () => {
    setIsStarting(true);
    setMessages([]);
    setSessionDetails(null);
    setActiveAgent("");
    setAgentState("");
    setStatusLog("Initializing engine...");
    
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

      if (!res.ok) {
        throw new Error('Failed to create session');
      }

      const data = await res.json();
      setActiveSessionId(data.sessionId);
      
      // Fetch session data
      setSessionDetails({
        id: data.sessionId,
        topic,
        rounds: maxRounds,
        status: 'active'
      });

      // Index RAG content if exists
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

  // Inject user input and resume
  const handleInjectComment = async () => {
    if (!humanInput.trim()) return;
    setIsPaused(false);
    const comment = humanInput;
    setHumanInput("");
    setStatusLog("Injecting user context and resuming turn-scheduler...");

    try {
      await fetch(`/api/debate/${activeSessionId}/inject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment })
      });
    } catch (e) {
      console.error(e);
      setStatusLog("Failed to submit human commentary.");
      setIsPaused(true);
    }
  };

  return (
    <div className="dashboard-grid">
      {/* Sidebar Configurations */}
      <aside className="glass-panel" style={{ padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div>
          <h3 style={{ fontSize: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
            Session Settings
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Debate Topic</label>
            <textarea 
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={3}
              style={{ width: '100%', resize: 'none', fontSize: '0.85rem' }}
            />

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Rounds</label>
                <select value={maxRounds} onChange={(e) => setMaxRounds(parseInt(e.target.value))} style={{ width: '100%', fontSize: '0.85rem' }}>
                  <option value={3}>3 Rounds</option>
                  <option value={4}>4 Rounds</option>
                  <option value={5}>5 Rounds</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>HITL Intercept</label>
                <select value={hitlInterval} onChange={(e) => setHitlInterval(e.target.value)} style={{ width: '100%', fontSize: '0.85rem' }}>
                  <option value="none">None</option>
                  <option value="every_round">Every Round</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
            Model Routing
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Debaters (Flash)</label>
              <select value={debaterModel} onChange={(e) => {setDebaterModel(e.target.value); setChallengerModel(e.target.value);}} style={{ width: '100%', fontSize: '0.8rem', padding: '6px' }}>
                <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                <option value="gemini-2.5-pro">gemini-2.5-pro</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Evaluator/Judge (Pro)</label>
              <select value={judgeModel} onChange={(e) => setJudgeModel(e.target.value)} style={{ width: '100%', fontSize: '0.8rem', padding: '6px' }}>
                <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                <option value="gemini-2.5-flash">gemini-2.5-flash</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.25rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={enableFactChecker} onChange={(e) => setEnableFactChecker(e.target.checked)} />
                Fact Checker Agent
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={enableSelfCritique} onChange={(e) => setEnableSelfCritique(e.target.checked)} />
                Agent Self-Critique turn
              </label>
            </div>
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
            RAG Grounding Document
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <input 
              type="text" 
              placeholder="Filename (e.g. guide.txt)"
              value={ragFilename} 
              onChange={(e) => setRagFilename(e.target.value)}
              style={{ fontSize: '0.8rem', padding: '6px' }}
            />
            <textarea 
              placeholder="Grounding reference text..."
              value={ragContent} 
              onChange={(e) => setRagContent(e.target.value)}
              rows={3}
              style={{ width: '100%', resize: 'none', fontSize: '0.8rem', padding: '6px' }}
            />
          </div>
        </div>

        <button 
          className="btn-primary" 
          onClick={handleLaunch} 
          disabled={isStarting || !!activeSessionId}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: 'auto' }}
        >
          <Sparkles size={16} />
          {isStarting ? "Spawning..." : "Launch Simulator"}
        </button>

        {sessions.length > 0 && (
          <div>
            <h3 style={{ fontSize: '0.85rem', color: 'var(--text-dark)', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.25rem', marginBottom: '0.5rem' }}>
              Historical Sessions
            </h3>
            <div style={{ maxHeight: '140px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {sessions.map(s => (
                <div 
                  key={s.id} 
                  onClick={() => loadDebateDetails(s.id)}
                  style={{ 
                    fontSize: '0.75rem', 
                    padding: '6px 8px', 
                    borderRadius: '4px', 
                    background: s.id === (sessionDetails?.id) ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)',
                    cursor: 'pointer',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    border: '1px solid rgba(255, 255, 255, 0.03)'
                  }}
                  title={s.topic}
                >
                  ⚖️ {s.topic}
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>

      {/* Primary Simulator Workspace */}
      <section className="view-content">
        {sessionDetails ? (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem', minHeight: 0 }}>
            
            {/* Real-time Agent Grid Orchestration Map */}
            <div className="glass-panel" style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                <div 
                  style={{
                    width: '46px', height: '46px', borderRadius: '50%',
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: `2px solid ${activeAgent === 'debater' ? 'var(--color-debater)' : 'rgba(59, 130, 246, 0.3)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: activeAgent === 'debater' ? '0 0 15px rgba(59, 130, 246, 0.4)' : 'none',
                    animation: activeAgent === 'debater' && agentState === 'thinking' ? 'pulse 1.2s infinite' : 'none',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <Brain size={20} color="var(--color-debater)" />
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main)' }}>Debater</span>
                {activeAgent === 'debater' && <span style={{ fontSize: '0.65rem', color: 'var(--color-debater)', textTransform: 'capitalize' }}>{agentState}</span>}
              </div>

              <div style={{ color: 'var(--text-dark)' }}>──➔</div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                <div 
                  style={{
                    width: '46px', height: '46px', borderRadius: '50%',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: `2px solid ${activeAgent === 'challenger' ? 'var(--color-challenger)' : 'rgba(239, 68, 68, 0.3)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: activeAgent === 'challenger' ? '0 0 15px rgba(239, 68, 68, 0.4)' : 'none',
                    animation: activeAgent === 'challenger' && agentState === 'thinking' ? 'pulse 1.2s infinite' : 'none',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <Cpu size={20} color="var(--color-challenger)" />
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main)' }}>Challenger</span>
                {activeAgent === 'challenger' && <span style={{ fontSize: '0.65rem', color: 'var(--color-challenger)', textTransform: 'capitalize' }}>{agentState}</span>}
              </div>

              <div style={{ color: 'var(--text-dark)' }}>──➔</div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                <div 
                  style={{
                    width: '46px', height: '46px', borderRadius: '50%',
                    background: 'rgba(245, 158, 11, 0.1)',
                    border: `2px solid ${activeAgent === 'fact_checker' ? 'var(--color-fact-checker)' : 'rgba(245, 158, 11, 0.3)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: activeAgent === 'fact_checker' ? '0 0 15px rgba(245, 158, 11, 0.4)' : 'none',
                    animation: activeAgent === 'fact_checker' && agentState === 'thinking' ? 'pulse 1.2s infinite' : 'none',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <Sparkles size={20} color="var(--color-fact-checker)" />
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main)' }}>Fact Checker</span>
                {activeAgent === 'fact_checker' && <span style={{ fontSize: '0.65rem', color: 'var(--color-fact-checker)', textTransform: 'capitalize' }}>{agentState}</span>}
              </div>

              <div style={{ color: 'var(--text-dark)' }}>──➔</div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                <div 
                  style={{
                    width: '46px', height: '46px', borderRadius: '50%',
                    background: 'rgba(168, 85, 247, 0.1)',
                    border: `2px solid ${activeAgent === 'judge' ? 'var(--color-judge)' : 'rgba(168, 85, 247, 0.3)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: activeAgent === 'judge' ? '0 0 15px rgba(168, 85, 247, 0.4)' : 'none',
                    animation: activeAgent === 'judge' && agentState === 'judging' ? 'pulse 1.2s infinite' : 'none',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <User size={20} color="var(--color-judge)" />
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main)' }}>Judge</span>
                {activeAgent === 'judge' && <span style={{ fontSize: '0.65rem', color: 'var(--color-judge)', textTransform: 'capitalize' }}>{agentState}</span>}
              </div>
            </div>

            {/* Chat Messages Log */}
            <div 
              className="glass-panel" 
              style={{ flex: 1, padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem', minHeight: 0 }}
              ref={scrollRef}
            >
              <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem' }}>
                <span className="badge badge-active">Session: {sessionDetails.id}</span>
                <h2 style={{ fontSize: '1.15rem', marginTop: '0.5rem' }}>{sessionDetails.topic}</h2>
              </div>

              {messages.length === 0 && !statusLog && (
                <div style={{ display: 'flex', flexContent: 'center', alignItems: 'center', height: '100%', flexDirection: 'column', color: 'var(--text-dark)', gap: '0.5rem', margin: 'auto' }}>
                  <Brain size={32} />
                  <span>Waiting for debate sequence to initialize...</span>
                </div>
              )}

              {messages.map((m) => {
                const isDebater = m.sender === 'debater';
                const isChallenger = m.sender === 'challenger';
                const isFact = m.sender === 'fact_checker';
                const isJudge = m.sender === 'judge';
                const isHuman = m.sender === 'human';

                let borderLeftColor = 'rgba(255,255,255,0.1)';
                let badgeClass = 'badge';
                if (isDebater) { borderLeftColor = 'var(--color-debater)'; badgeClass += ' badge-debater'; }
                if (isChallenger) { borderLeftColor = 'var(--color-challenger)'; badgeClass += ' badge-challenger'; }
                if (isFact) { borderLeftColor = 'var(--color-fact-checker)'; badgeClass += ' badge-fact-checker'; }
                if (isJudge) { borderLeftColor = 'var(--color-judge)'; badgeClass += ' badge-judge'; }
                if (isHuman) { borderLeftColor = 'var(--color-human)'; badgeClass += ' badge-human'; }

                return (
                  <div 
                    key={m.id || Math.random()} 
                    className="animate-slide-up"
                    style={{ 
                      padding: '1rem', 
                      borderRadius: '8px', 
                      background: 'rgba(255,255,255,0.015)',
                      borderLeft: `4px solid ${borderLeftColor}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className={badgeClass}>{m.sender.toUpperCase()}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-dark)' }}>Round {m.round}</span>
                      </div>
                      
                      {/* LLM Metrics */}
                      {m.metrics && m.metrics.totalTokens > 0 && (
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-dark)', display: 'flex', gap: '0.75rem' }}>
                          <span>Latency: {m.metrics.latencyMs}ms</span>
                          <span>Tokens: {m.metrics.totalTokens}</span>
                          <span style={{ color: 'var(--accent)' }}>Cost: ${m.metrics.costUsd?.toFixed(5)}</span>
                        </div>
                      )}
                    </div>
                    
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', whiteSpace: 'pre-wrap' }}>
                      {m.content}
                    </p>
                  </div>
                );
              })}

              {statusLog && (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem', 
                  color: 'var(--text-muted)', 
                  fontFamily: 'var(--font-mono)', 
                  fontSize: '0.8rem',
                  padding: '0.5rem 1rem',
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: '6px'
                }}>
                  <RefreshCw size={14} className="animate-float" style={{ animationDuration: '2s' }} />
                  {statusLog}
                </div>
              )}
            </div>

            {/* Human in the Loop Interceptor */}
            {isPaused && (
              <div 
                className="glass-panel animate-slide-up" 
                style={{ 
                  padding: '1rem', 
                  border: '1px solid rgba(16, 185, 129, 0.3)', 
                  background: 'rgba(16, 185, 129, 0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-human)' }}>
                  <AlertTriangle size={18} />
                  <h4 style={{ fontSize: '0.9rem', color: 'var(--color-human)' }}>Human-in-the-Loop Intervention Required</h4>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  The debate has paused at a round boundary. As a director, you can inject comments, critiques, or supply new facts to guide the agents' reasoning.
                </p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input 
                    type="text" 
                    placeholder="Type feedback for the agents (e.g. 'Debater, focus more on retrenchment costs...')"
                    value={humanInput}
                    onChange={(e) => setHumanInput(e.target.value)}
                    style={{ flex: 1, fontSize: '0.85rem' }}
                    onKeyDown={(e) => e.key === 'Enter' && handleInjectComment()}
                  />
                  <button className="btn-primary" onClick={handleInjectComment} style={{ background: 'var(--color-human)', boxShadow: 'none' }}>
                    <Send size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* Verdict Display */}
            {sessionDetails.verdict && (
              <div className="glass-panel animate-slide-up" style={{ padding: '1.25rem', border: '1px solid rgba(168, 85, 247, 0.35)', background: 'rgba(168, 85, 247, 0.02)' }}>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--color-judge)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  ⚖️ Judge Final Verdict: Winner declared {sessionDetails.verdict.winner}
                </h3>
                
                {/* Score Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ background: 'rgba(59,130,246,0.03)', border: '1px solid rgba(59,130,246,0.1)', padding: '0.75rem', borderRadius: '6px' }}>
                    <h4 style={{ fontSize: '0.85rem', color: 'var(--color-debater)', marginBottom: '0.5rem' }}>Debater Scorecard</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.25rem', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                      <div>Rhetoric: {sessionDetails.verdict.scores?.debater?.rhetoric || 80}</div>
                      <div>Evidence: {sessionDetails.verdict.scores?.debater?.evidence || 80}</div>
                      <div>Rebuttals: {sessionDetails.verdict.scores?.debater?.rebuttals || 80}</div>
                    </div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, marginTop: '0.25rem', color: '#fff' }}>
                      Overall: {sessionDetails.verdict.scores?.debater?.total || 80}
                    </div>
                  </div>

                  <div style={{ background: 'rgba(239,68,68,0.03)', border: '1px solid rgba(239,68,68,0.1)', padding: '0.75rem', borderRadius: '6px' }}>
                    <h4 style={{ fontSize: '0.85rem', color: 'var(--color-challenger)', marginBottom: '0.5rem' }}>Challenger Scorecard</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.25rem', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                      <div>Rhetoric: {sessionDetails.verdict.scores?.challenger?.rhetoric || 80}</div>
                      <div>Evidence: {sessionDetails.verdict.scores?.challenger?.evidence || 80}</div>
                      <div>Rebuttals: {sessionDetails.verdict.scores?.challenger?.rebuttals || 80}</div>
                    </div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, marginTop: '0.25rem', color: '#fff' }}>
                      Overall: {sessionDetails.verdict.scores?.challenger?.total || 80}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  <strong>Judge Summary:</strong> {sessionDetails.verdict.summary}
                </div>
                {sessionDetails.verdict.recommendation && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-dark)', marginTop: '0.5rem' }}>
                    <strong>Recommendations:</strong> {sessionDetails.verdict.recommendation}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="glass-panel" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '0.75rem', color: 'var(--text-muted)' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.05)' }}>
              <Brain size={48} className="animate-float" />
            </div>
            <h3 style={{ color: '#fff' }}>Debate Simulator Idle</h3>
            <p style={{ fontSize: '0.85rem', maxWidth: '360px', textAlign: 'center' }}>
              Select a topic, configure the multi-agent model routing variables in the sidebar, and launch to begin the simulation.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

export default OrchestratorView;
