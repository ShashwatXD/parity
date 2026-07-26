import React, { useState, useEffect } from 'react';
import OrchestratorView from './components/OrchestratorView.jsx';
import ObservabilityView from './components/ObservabilityView.jsx';
import EvaluatorView from './components/EvaluatorView.jsx';
import { Activity, ShieldAlert, BarChart3, Binary, Terminal } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState('arena');
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch debates list periodically or on mount
  const fetchDebates = async () => {
    try {
      const res = await fetch('/api/debates');
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch (e) {
      console.error("Failed to load debates list", e);
    }
  };

  useEffect(() => {
    fetchDebates();
    const interval = setInterval(fetchDebates, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="layout-container">
      {/* Premium Header */}
      <header className="app-header">
        <div className="brand">
          <div className="logo-icon">⚖️</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span className="logo-text">PARITY</span>
              <span className="logo-tag">Agent Engine</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-dark)' }}>
              Multi-Agent AI Debate Orchestrator & Evaluation Suite
            </p>
          </div>
        </div>

        {/* Tab Control */}
        <nav className="nav-tabs">
          <button 
            className={`tab-btn ${activeTab === 'arena' ? 'active' : ''}`}
            onClick={() => setActiveTab('arena')}
          >
            <Terminal size={16} />
            Debate Arena
          </button>
          <button 
            className={`tab-btn ${activeTab === 'observability' ? 'active' : ''}`}
            onClick={() => setActiveTab('observability')}
          >
            <BarChart3 size={16} />
            Observability Dashboard
          </button>
          <button 
            className={`tab-btn ${activeTab === 'evaluator' ? 'active' : ''}`}
            onClick={() => setActiveTab('evaluator')}
          >
            <Binary size={16} />
            Offline Evaluator
          </button>
        </nav>

        {/* Global Connection Badge */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div className="badge badge-active" style={{ gap: '0.35rem' }}>
            <Activity size={12} className="animate-float" />
            System: Active
          </div>
        </div>
      </header>

      {/* Main View Display */}
      <main style={{ flex: 1, minHeight: 0 }}>
        {activeTab === 'arena' && (
          <OrchestratorView sessions={sessions} onDebateCreated={fetchDebates} />
        )}
        {activeTab === 'observability' && (
          <ObservabilityView sessions={sessions} />
        )}
        {activeTab === 'evaluator' && (
          <EvaluatorView />
        )}
      </main>
    </div>
  );
}

export default App;
