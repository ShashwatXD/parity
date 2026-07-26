import React, { useState, useEffect } from 'react';
import OrchestratorView from './components/OrchestratorView.jsx';
import ObservabilityView from './components/ObservabilityView.jsx';
import EvaluatorView from './components/EvaluatorView.jsx';
import { Activity, BarChart3, Binary, Terminal, Scale } from 'lucide-react';
import { Badge } from './design/ui.jsx';

function App() {
  const [activeTab, setActiveTab] = useState('arena');
  const [sessions, setSessions] = useState([]);

  const fetchDebates = async () => {
    try {
      const res = await fetch('/api/debates');
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch (e) {
      console.error('Failed to load debates list', e);
    }
  };

  useEffect(() => {
    fetchDebates();
    const interval = setInterval(fetchDebates, 10000);
    return () => clearInterval(interval);
  }, []);

  const tabs = [
    { id: 'arena', label: 'Debate Arena', icon: Terminal },
    { id: 'observability', label: 'Observability', icon: BarChart3 },
    { id: 'evaluator', label: 'Offline Evaluator', icon: Binary }
  ];

  return (
    <div className="layout-container">
      <header className="app-header">
        <div className="brand">
          <div className="brand-mark">
            <Scale size={18} />
          </div>
          <div>
            <div className="brand-title">
              <span className="brand-name">Parity</span>
              <span className="brand-tag">Agent Engine</span>
            </div>
            <p className="brand-sub">Multi-agent debate orchestrator & evaluation suite</p>
          </div>
        </div>

        <nav className="nav-tabs">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`tab-btn ${activeTab === id ? 'active' : ''}`}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </nav>

        <Badge tone="active">
          <Activity size={12} className="animate-float" />
          System active
        </Badge>
      </header>

      <main className="flex-1" style={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {activeTab === 'arena' && (
          <OrchestratorView sessions={sessions} onDebateCreated={fetchDebates} />
        )}
        {activeTab === 'observability' && <ObservabilityView sessions={sessions} />}
        {activeTab === 'evaluator' && <EvaluatorView />}
      </main>
    </div>
  );
}

export default App;
