
import { useEffect, useState, useCallback, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import api from '../api/client';
import { ENDPOINTS } from '../config/api';

const normalizeTicketToken = (value) => {
  let token = String(value || '').trim();
  if (!token) return '';

  try {
    const parsed = JSON.parse(token);
    if (parsed && typeof parsed === 'object') {
      token = String(parsed.token || parsed.qrToken || parsed.ticketToken || token).trim();
    }
  } catch {
    // Plain token or URL payload.
  }

  try {
    const url = new URL(token, window.location.origin);
    const extracted =
      url.searchParams.get('token') ||
      url.searchParams.get('qrToken') ||
      url.searchParams.get('ticketToken');
    if (extracted) return extracted.trim();
  } catch {
    // Not a URL.
  }

  if (token.includes('token=')) {
    const params = new URLSearchParams(token.startsWith('?') ? token.slice(1) : token);
    const extracted = params.get('token') || params.get('qrToken') || params.get('ticketToken');
    if (extracted) return extracted.trim();
  }

  return token.split('&')[0].trim();
};

// Inner scanner — only mounted when camera mode is active
const ScannerCore = ({ onScanSuccess, onPermissionError }) => {
  const scannerRef = useRef(null);
  const calledbackRef = useRef(false); // prevent double-firing callbacks

  useEffect(() => {
    calledbackRef.current = false;

    // Ensure the reader div is completely empty before html5-qrcode touches it
    // (fixes "removeChild: node is not a child" on fast remounts)
    const readerEl = document.getElementById('reader');
    if (readerEl) readerEl.innerHTML = '';

    const scanner = new Html5QrcodeScanner('reader', {
      qrbox: { width: 260, height: 260 },
      fps: 15,
      rememberLastUsedCamera: true,
      aspectRatio: 1.0,
      showTorchButtonIfSupported: true,
    });
    scannerRef.current = scanner;

    scanner.render(
      (result) => {
        if (calledbackRef.current) return;
        calledbackRef.current = true;
        const token = normalizeTicketToken(result);
        if (window.navigator.vibrate) window.navigator.vibrate(100);
        scanner.clear().catch(() => {});
        onScanSuccess(token);
      },
      (err) => {
        if (calledbackRef.current) return;
        const msg = typeof err === 'string' ? err : (err?.message || '');
        if (
          msg.includes('NotAllowedError') ||
          msg.includes('Permission denied') ||
          msg.includes('permission')
        ) {
          calledbackRef.current = true;
          scanner.clear().catch(() => {});
          onPermissionError();
        }
        // All other errors are normal per-frame misses — ignore
      }
    );

    // Fallback: watch the status span text that html5-qrcode renders
    const observer = new MutationObserver(() => {
      if (calledbackRef.current) return;
      const statusSpan = document.getElementById('reader__status_span');
      const text = statusSpan?.textContent || '';
      if (text.includes('NotAllowedError') || text.includes('Permission denied')) {
        calledbackRef.current = true;
        observer.disconnect();
        scanner.clear().catch(() => {});
        onPermissionError();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => {
      observer.disconnect();
      scannerRef.current = null;
      // Safely clear — catch both the promise rejection AND any sync removeChild throws
      try {
        scanner.clear().catch(() => {});
      } catch {
        // swallow removeChild / not-a-child errors from html5-qrcode internals
      }
      // Manually wipe the reader div so the next mount starts clean
      setTimeout(() => {
        const el = document.getElementById('reader');
        if (el) el.innerHTML = '';
      }, 0);
    };
  }, []); // eslint-disable-line

  return (
    <div className="reader-wrapper">
      <div id="reader"></div>
      <div className="scanning-beam"></div>
    </div>
  );
};

// Manual token entry fallback
const ManualEntry = ({ onSubmit, onSwitchToCamera }) => {
  const [token, setToken] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = normalizeTicketToken(token);
    if (!trimmed) return;
    onSubmit(trimmed);
    setToken('');
  };

  return (
    <div className="manual-entry-wrapper">
      <div className="manual-entry-icon">⌨️</div>
      <p className="manual-entry-label">Enter Ticket Token Manually</p>
      <form onSubmit={handleSubmit} className="manual-entry-form">
        <input
          ref={inputRef}
          type="text"
          className="manual-token-input"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Paste or type ticket token..."
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
        />
        <button type="submit" className="btn-base btn-primary" style={{ width: '100%' }} disabled={!token.trim()}>
          VERIFY
        </button>
      </form>
      <button className="btn-base btn-ghost" style={{ marginTop: '1rem', width: '100%' }} onClick={onSwitchToCamera}>
        📷 Try Camera Again
      </button>
    </div>
  );
};

// Permission denied screen
const PermissionDenied = ({ onManualEntry, onRetry }) => (
  <div className="permission-denied-wrapper">
    <div className="permission-icon">🚫</div>
    <h3 className="permission-title">Camera Access Denied</h3>
    <p className="permission-msg">
      Your browser blocked camera access. This usually happens because:
    </p>
    <ul className="permission-reasons">
      <li>The app is running on HTTP instead of HTTPS</li>
      <li>Camera permission was previously denied</li>
      <li>No camera is detected on this device</li>
    </ul>
    <p className="permission-fix">
      To fix: click the 🔒 icon in your browser address bar → allow camera → reload the page.
    </p>
    <div className="permission-actions" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '2rem' }}>
      <button className="btn-base btn-primary" onClick={onManualEntry}>
        ⌨️ Enter Token Manually
      </button>
      <button className="btn-base btn-ghost" onClick={onRetry}>
        🔄 Retry Camera
      </button>
    </div>
  </div>
);

// ── Main Scanner Component ─────────────────────────────────────────────────
const Scanner = () => {
  const [mode, setMode] = useState('camera'); // 'camera' | 'manual' | 'permission-denied'
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [scannerKey, setScannerKey] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);
  const [showResult, setShowResult] = useState(false);

  const speakFeedback = useCallback((text) => {
    try {
      if ('speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 1.2;
        window.speechSynthesis.speak(u);
      }
    } catch { /* ignore */ }
  }, []);

  const playSuccessSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch { /* ignore */ }
  }, []);

  const verifyTicket = useCallback(async (token) => {
    const normalizedToken = normalizeTicketToken(token);
    setShowResult(false);
    setVerifying(true);
    setError(null);
    setScanResult(null);

    try {
      const response = await api.post(ENDPOINTS.SCANNER_VERIFY, { token: normalizedToken });
      setScanResult(response.data);
      setSessionCount(prev => prev + 1);
      setShowResult(true);
      speakFeedback('Verified');
      playSuccessSound();
    } catch (err) {
      const serverMessage = err.response?.data?.error;
      const status = err.response?.status;
      const errorMsg = serverMessage || 'Invalid or Expired Ticket';
      // Include status code for easier debugging by operators
      setError(status ? `${errorMsg} (${status})` : errorMsg);
      setShowResult(true);
      speakFeedback(errorMsg === 'Already Used' ? 'Duplicate' : 'Invalid');
    } finally {
      setVerifying(false);
    }
  }, [playSuccessSound, speakFeedback]);

  const handleReset = useCallback(() => {
    setScanResult(null);
    setError(null);
    setVerifying(false);
    setShowResult(false);
    if (mode === 'camera') setScannerKey(prev => prev + 1);
  }, [mode]);

  const handlePermissionError = useCallback(() => {
    setMode('permission-denied');
  }, []);

  const handleRetryCamera = useCallback(() => {
    setMode('camera');
    setScannerKey(prev => prev + 1);
    setShowResult(false);
    setError(null);
    setScanResult(null);
  }, []);

  // Auto-reset after result
  useEffect(() => {
    if (!showResult) return;
    const timer = setTimeout(() => handleReset(), 4000);
    return () => clearTimeout(timer);
  }, [showResult, handleReset]);

  return (
    <div className="cyber-container animate-fade-up" style={{ padding: '2rem 0', maxWidth: '560px' }}>
      <header className="flex-between" style={{ marginBottom: '2.5rem' }}>
        <div>
          <h1 className="title-main text-gradient" style={{ margin: 0, fontSize: '2rem' }}>SENTINEL SCANNER</h1>
          <div className="cyber-badge badge-success" style={{ fontSize: '0.6rem', marginTop: '0.5rem' }}>PROTOCOL: EVENT_ACCESS_VALIDATION</div>
        </div>
      </header>

      <div className="cyber-card" style={{ padding: '1.5rem', minHeight: '380px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {showResult && scanResult && (
          <div className="animate-fade-up flex-column" style={{ alignItems: 'center', gap: '2rem', textAlign: 'center' }}>
            <div className="flex-center" style={{ width: '80px', height: '80px', background: 'rgba(0, 230, 118, 0.1)', borderRadius: '50%', border: '2px solid var(--success)', fontSize: '2.5rem', color: 'var(--success)', boxShadow: '0 0 20px rgba(0, 230, 118, 0.3)' }}>✓</div>
            <div className="flex-column" style={{ gap: '0.5rem' }}>
              <h2 className="text-main" style={{ letterSpacing: '2px', fontWeight: '900' }}>ACCESS GRANTED</h2>
              <p className="text-muted" style={{ fontSize: '0.8rem' }}>IDENTITY VERIFIED AND TOKEN CONSUMED</p>
            </div>
            
            <div className="glass-panel" style={{ width: '100%', padding: '1.5rem', textAlign: 'left' }}>
              <div className="cyber-grid" style={{ gridTemplateColumns: '1fr', gap: '1rem' }}>
                <div>
                  <label className="cyber-label" style={{ fontSize: '0.6rem' }}>PATRON_ID</label>
                  <div className="text-main" style={{ fontWeight: '700' }}>{scanResult.customerName?.toUpperCase()}</div>
                </div>
                <div>
                  <label className="cyber-label" style={{ fontSize: '0.6rem' }}>PRODUCTION_CLASS</label>
                  <div className="text-main" style={{ fontWeight: '700' }}>{scanResult.eventName?.toUpperCase()}</div>
                </div>
              </div>
            </div>
            
            <button className="cyber-btn btn-primary" style={{ width: '100%' }} onClick={handleReset}>READY FOR NEXT UNIT</button>
          </div>
        )}

        {showResult && error && (
          <div className="animate-fade-up flex-column" style={{ alignItems: 'center', gap: '2rem', textAlign: 'center' }}>
            <div className="flex-center" style={{ width: '80px', height: '80px', background: 'rgba(255, 82, 82, 0.1)', borderRadius: '50%', border: '2px solid var(--danger)', fontSize: '2.5rem', color: 'var(--danger)', boxShadow: '0 0 20px rgba(255, 82, 82, 0.3)' }}>✕</div>
            <div className="flex-column" style={{ gap: '0.5rem' }}>
              <h2 className="text-main" style={{ letterSpacing: '2px', fontWeight: '900', color: 'var(--danger)' }}>
                {error === 'Already Used' ? 'DUPLICATE TOKEN' : 'ACCESS DENIED'}
              </h2>
              <p className="text-muted" style={{ fontSize: '0.8rem' }}>SECURITY PROTOCOL BREACH DETECTED</p>
            </div>
            
            <div className="cyber-badge badge-danger" style={{ width: '100%', padding: '1rem' }}>
              ERR_CODE: {error?.toUpperCase()}
            </div>
            
            <button className="cyber-btn btn-outline" style={{ width: '100%', borderColor: 'var(--danger)', color: 'var(--danger)' }} onClick={handleReset}>RETRY SCAN</button>
          </div>
        )}

        {verifying && (
          <div className="flex-center flex-column" style={{ gap: '2rem' }}>
             <div style={{ width: '60px', height: '60px', border: '4px solid var(--bg-accent)', borderTopColor: 'var(--accent-cyan)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
             <div className="text-glow" style={{ letterSpacing: '2px', fontWeight: '800' }}>UPLOADING TO MATRIX...</div>
          </div>
        )}

        {!showResult && !verifying && (
          <div className="flex-column" style={{ gap: '2rem' }}>
            {mode === 'camera' && (
              <>
                <ScannerCore
                  key={scannerKey}
                  onScanSuccess={verifyTicket}
                  onPermissionError={handlePermissionError}
                />
                <button
                  className="cyber-btn btn-outline"
                  style={{ width: '100%' }}
                  onClick={() => setMode('manual')}
                >
                  ⌨️ MANUAL OVERRIDE
                </button>
              </>
            )}

            {mode === 'manual' && (
              <ManualEntry
                onSubmit={verifyTicket}
                onSwitchToCamera={handleRetryCamera}
              />
            )}

            {mode === 'permission-denied' && (
              <PermissionDenied
                onManualEntry={() => setMode('manual')}
                onRetry={handleRetryCamera}
              />
            )}
          </div>
        )}
      </div>

      <footer className="flex-between" style={{ marginTop: '2rem' }}>
        <div className="flex-column">
          <span className="text-dim" style={{ fontSize: '0.6rem', fontWeight: '800' }}>OPERATOR: GATE_SENTINEL</span>
          <div className="text-main" style={{ fontSize: '0.8rem', fontWeight: '700' }}>
            TOTAL_VERIFICATIONS: <span className="text-glow" style={{ color: 'var(--accent-cyan)' }}>{sessionCount}</span>
          </div>
        </div>
        <span className="text-dim" style={{ fontSize: '0.6rem' }}>🔒 E2E_ENCRYPTED_STREAM</span>
      </footer>
      
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        #reader { border: none !important; background: transparent !important; }
        #reader img { display: none !important; }
        #reader__status_span { display: none !important; }
        #reader__dashboard_section_csr { display: none !important; }
        .reader-wrapper { position: relative; border-radius: 12px; overflow: hidden; border: 1px solid var(--border-dim); }
        .scanning-beam { position: absolute; top: 0; left: 0; width: 100%; height: 2px; background: var(--accent-cyan); box-shadow: 0 0 15px var(--accent-cyan); animation: scanLoop 2s ease-in-out infinite; z-index: 5; pointer-events: none; }
        @keyframes scanLoop { 0%, 100% { top: 5%; } 50% { top: 95%; } }
      `}</style>
    </div>
  );
};

export default Scanner;
