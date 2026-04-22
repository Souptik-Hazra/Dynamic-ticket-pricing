
import { useEffect, useState, useCallback, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import api from '../api/client';
import { ENDPOINTS } from '../config/api';
import './Scanner.css';

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
        // Safely extract token whether result is a full URL or a bare token
        let token = result.trim();
        try {
          // If it looks like a URL, parse it properly (handles extra params like &utm=xyz)
          if (token.startsWith('http://') || token.startsWith('https://') || token.includes('?')) {
            const url = new URL(token.includes('://') ? token : `https://x.com/${token}`);
            const extracted = url.searchParams.get('token');
            if (extracted) token = extracted;
          }
        } catch {
          // Not a URL — use raw value (bare token pasted manually)
        }
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
    const trimmed = token.trim();
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
        <button type="submit" className="manual-submit-btn" disabled={!token.trim()}>
          VERIFY
        </button>
      </form>
      <button className="switch-mode-btn" onClick={onSwitchToCamera}>
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
    <div className="permission-actions">
      <button className="manual-submit-btn" onClick={onManualEntry}>
        ⌨️ Enter Token Manually
      </button>
      <button className="switch-mode-btn" onClick={onRetry}>
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

  const verifyTicket = useCallback(async (token) => {
    setShowResult(false);
    setVerifying(true);
    setError(null);
    setScanResult(null);

    try {
      const response = await api.post(ENDPOINTS.SCANNER_VERIFY, { token });
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
  }, []);

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

  const speakFeedback = (text) => {
    try {
      if ('speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 1.2;
        window.speechSynthesis.speak(u);
      }
    } catch { /* ignore */ }
  };

  const playSuccessSound = () => {
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
  };

  return (
    <div className="event-mode-scanner">
      <div className="scanner-header">
        <span className="mode-badge">EVENT MODE ACTIVE</span>
        <h2 className="scanner-title">Secure Verification</h2>
      </div>

      <div className="scanner-viewport">

        {showResult && scanResult && (
          <div className="entry-card success">
            <div className="entry-status">VERIFIED</div>
            <div className="entry-icon">✓</div>
            <div className="entry-details">
              <div className="detail-item">
                <label>PATRON</label>
                <span>{scanResult.customerName}</span>
              </div>
              <div className="detail-item">
                <label>EVENT</label>
                <span>{scanResult.eventName}</span>
              </div>
            </div>
            <button className="next-scan-btn" onClick={handleReset}>READY FOR NEXT</button>
          </div>
        )}

        {showResult && error && (
          <div className={`entry-card ${error === 'Already Used' ? 'duplicate' : 'denied'}`}>
            <div className="entry-status">{error === 'Already Used' ? 'DUPLICATE' : 'INVALID'}</div>
            <div className="entry-icon">{error === 'Already Used' ? '⚠' : '✕'}</div>
            <div className="entry-details">
              <p className="error-msg">{error}</p>
            </div>
            <button className="retry-btn" onClick={handleReset}>TRY AGAIN</button>
          </div>
        )}

        {verifying && (
          <div className="verifying-status">
            <div className="pulse-loader"></div>
            <p>VALIDATING...</p>
          </div>
        )}

        {!showResult && !verifying && (
          <>
            {mode === 'camera' && (
              <>
                <ScannerCore
                  key={scannerKey}
                  onScanSuccess={verifyTicket}
                  onPermissionError={handlePermissionError}
                />
                <button
                  className="switch-mode-btn manual-fallback-btn"
                  onClick={() => setMode('manual')}
                >
                  ⌨️ Enter Token Manually
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
          </>
        )}
      </div>

      <footer className="scanner-footer">
        <div className="session-status">
          <p>Personnel: Gate Staff</p>
          <div className="session-stats-pill">
            Session Scans: <span>{sessionCount}</span>
          </div>
        </div>
        <p className="security-note">🔒 End-to-End Encrypted Verification</p>
      </footer>
    </div>
  );
};

export default Scanner;
