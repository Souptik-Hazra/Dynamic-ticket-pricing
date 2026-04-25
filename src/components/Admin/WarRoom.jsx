import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import LiveIntelligence from './LiveIntelligence';

/**
 * 🛰️ War-Room Command Center (Phase 11: Founder's Legacy)
 * 
 * The ultimate administrative visibility layer.
 * Aggregates all system intelligence into one premium dashboard.
 */

const WarRoom = () => {
  const [metrics, setMetrics] = useState({
    cpu: 24,
    memory: 450,
    botAttacks: 12,
    aiRevenue: 45000,
    activeRooms: 8
  });
  const [isAiDisabled, setIsAiDisabled] = useState(false);

  const toggleAiPanic = async () => {
    // In a real app, this would call the API
    setIsAiDisabled(!isAiDisabled);
  };

  // Simulated real-time system vitals
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(prev => ({
        ...prev,
        cpu: 20 + Math.floor(Math.random() * 10),
        memory: 400 + Math.floor(Math.random() * 100),
        aiRevenue: prev.aiRevenue + Math.floor(Math.random() * 100)
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="cyber-container animate-fade-up">
      <div className="flex-between" style={{ padding: '2rem 0' }}>
        <div>
          <h1 className="title-main" style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>War-Room</h1>
          <p className="text-muted">Command & Control Intelligence for Diamond Monolith</p>
        </div>
        <div className="flex-center" style={{ gap: '1rem' }}>
          <button 
            onClick={toggleAiPanic}
            className={`cyber-btn ${isAiDisabled ? 'btn-success' : 'btn-danger'} cyber-pulse`}
            style={{ padding: '0.5rem 1.5rem' }}
          >
            {isAiDisabled ? 'RE-ENABLE AI' : '🔴 AI PANIC SWITCH'}
          </button>
          <div className="cyber-badge badge-success">SYSTEMS ONLINE</div>
        </div>
      </div>

      <div className="cyber-grid" style={{ gridTemplateColumns: '1fr 2fr' }}>
        
        {/* 🛡️ SECURITY & VITALS */}
        <div className="flex-column" style={{ gap: '1.25rem' }}>
          <div className="cyber-card" style={{ borderLeft: '4px solid var(--accent-cyan)' }}>
            <div className="cyber-label">System Vitals</div>
            <div className="flex-between" style={{ marginTop: '1rem' }}>
              <span className="text-muted">CPU Load</span>
              <span className="text-glow">{metrics.cpu}%</span>
            </div>
            <div className="flex-between">
              <span className="text-muted">Heap Memory</span>
              <span className="text-glow">{metrics.memory}MB</span>
            </div>
          </div>

          <div className="cyber-card" style={{ borderLeft: '4px solid var(--danger)' }}>
            <div className="cyber-label">Security Sentinel</div>
            <div className="flex-between" style={{ marginTop: '1rem' }}>
              <span className="text-muted">Bot Deflections</span>
              <span className="badge-danger cyber-badge">{metrics.botAttacks}</span>
            </div>
            <div className="flex-between" style={{ marginTop: '0.5rem' }}>
              <span className="text-muted">IPs Blacklisted</span>
              <span className="text-main">124</span>
            </div>
          </div>
        </div>

        {/* 🧠 AI & REVENUE INTELLIGENCE */}
        <div className="flex-column" style={{ gap: '1.25rem' }}>
          <LiveIntelligence eventId="master" />
          
          <div className="cyber-card">
            <div className="cyber-label">Real-Time Event Streams</div>
            <div className="cyber-table-container" style={{ marginTop: '1rem', minHeight: 'auto' }}>
              <table className="cyber-table">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Action</th>
                    <th>Intelligence</th>
                    <th>ROI</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>AI-Pricing</td>
                    <td>Model B Applied</td>
                    <td><span className="badge-info cyber-badge">Momentum +5%</span></td>
                    <td><span className="text-success">+₹250</span></td>
                  </tr>
                  <tr>
                    <td>Bot-Shield</td>
                    <td>Challenge Solved</td>
                    <td><span className="badge-success cyber-badge">Verified Human</span></td>
                    <td>-</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default WarRoom;
