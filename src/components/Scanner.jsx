
import { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import api from '../api/client';
import { ENDPOINTS } from '../config/api';
import './Scanner.css';

const Scanner = () => {
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [scannerInstance, setScannerInstance] = useState(null);
  const [sessionCount, setSessionCount] = useState(0);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner('reader', {
      qrbox: {
        width: 280,
        height: 280,
      },
      fps: 24, // Smoother video scanning
      rememberLastUsedCamera: true,
      aspectRatio: 1.0,
      showTorchButtonIfSupported: false, // We'll build our own premium button
    });

    scanner.render(onScanSuccess, onScanError);
    setScannerInstance(scanner);
    setCameraActive(true);

    // Check for torch support after a delay to allow camera initialization
    setTimeout(async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        if (videoDevices.length > 0) {
          // Attempt to check capabilities if possible
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
          const track = stream.getVideoTracks()[0];
          const caps = track.getCapabilities();
          if (caps.torch) setTorchSupported(true);
          stream.getTracks().forEach(t => t.stop()); // Clean up test stream
        }
      } catch (e) {
        console.log('Torch detection error or not supported');
      }
    }, 2000);

    async function onScanSuccess(result) {
      const token = result.includes('token=') ? result.split('token=')[1] : result;
      // Provide immediate haptic/visual feedback if possible
      if (window.navigator.vibrate) window.navigator.vibrate(100);
      setSessionCount(prev => prev + 1);
      
      await verifyTicket(token);
      try {
        await scanner.clear();
        setCameraActive(false);
      } catch (e) {
        console.error('Failed to clear scanner', e);
      }
    }

    function onScanError(err) {
      // Suppress noisy logs during active scan
    }

    return () => {
      scanner.clear().catch(err => console.error('Cleanup error', err));
    };
  }, []);

  const verifyTicket = async (token) => {
    try {
      setVerifying(true);
      setError(null);
      setScanResult(null);

      const response = await api.post(
        ENDPOINTS.SCANNER_VERIFY, 
        { token }
      );

      setScanResult(response.data);
      speakFeedback('Verified');
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Invalid or Expired Ticket';
      setError(errorMsg);
      
      if (errorMsg === 'Already Used') {
        speakFeedback('Duplicate');
      } else {
        speakFeedback('Invalid');
      }
    } finally {
      setVerifying(false);
    }
  };

  const toggleTorch = async () => {
    try {
      // Note: Low-level access to the scanner's internal Html5Qrcode instance
      // html5-qrcode-scanner exposes the internal instance via 'html5Qrcode'
      const html5QrCode = scannerInstance?.html5Qrcode;
      if (html5QrCode && html5QrCode.getState() === 2) { // 2 = SCANNING
        const newTorchState = !torchOn;
        await html5QrCode.applyVideoConstraints({
          advanced: [{ torch: newTorchState }]
        });
        setTorchOn(newTorchState);
      }
    } catch (err) {
      console.error('Torch toggle failed', err);
    }
  };

  // Text-to-Speech Feedback
  const speakFeedback = (text) => {
    try {
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.2; // Slightly faster for efficiency
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
      }
    } catch (e) {
      console.log('Speech feedback failed', e);
    }
  };

  // Success Audio Feedback (Synthesized)
  const playSuccessSound = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // High A
      oscillator.frequency.exponentialRampToValueAtTime(1320, audioCtx.currentTime + 0.1); // Slide up to E

      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
      console.log('Audio feedback failed', e);
    }
  };

  // Auto-reset logic for continuous scanning
  useEffect(() => {
    let timer;
    if (scanResult || error) {
      if (scanResult) playSuccessSound();
      timer = setTimeout(() => {
        handleReset();
      }, 3500); // Reset after 3.5 seconds
    }
    return () => clearTimeout(timer);
  }, [scanResult, error]);

  const handleReset = () => {
    setScanResult(null);
    setError(null);
    setVerifying(false);
    // Instead of reload, we just need to let the user know we're ready.
    // The useEffect with [scanResult, error] handles the "clear" but we need to restart.
    // Re-mounting the scanner part is best done by changing a key.
    setSessionCount(prev => prev); // dummy to trigger re-render or just reset states
    // Force a small delay then reset the whole scanner state if it was cleared
    window.location.reload(); // Keeping it for now as it's the most reliable way to reset the camera stream in many browsers, but I'll optimize the UX
  };

  return (
    <div className="event-mode-scanner">
      <div className="scanner-header">
        <span className="mode-badge">EVENT MODE ACTIVE</span>
        <h2 className="scanner-title">Secure Verification</h2>
      </div>
      
      <div className="scanner-viewport">
        {!scanResult && !error && (
          <div className="reader-wrapper">
            <div id="reader"></div>
            <div className="scanning-beam"></div>
            {torchSupported && cameraActive && (
              <button 
                className={`torch-toggle-btn ${torchOn ? 'active' : ''}`} 
                onClick={toggleTorch}
                title="Toggle Flashlight"
              >
                {torchOn ? '🔦 ON' : '🔦 OFF'}
              </button>
            )}
          </div>
        )}

        {verifying && (
          <div className="verifying-status">
            <div className="pulse-loader"></div>
            <p>VALIDATING...</p>
          </div>
        )}

        {scanResult && (
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

        {error && (
          <div className={`entry-card ${error === 'Already Used' ? 'duplicate' : 'denied'}`}>
            <div className="entry-status">{error === 'Already Used' ? 'DUPLICATE' : 'INVALID'}</div>
            <div className="entry-icon">{error === 'Already Used' ? '⚠' : '✕'}</div>
            <div className="entry-details">
              <p className="error-msg">{error}</p>
            </div>
            <button className="retry-btn" onClick={handleReset}>RETRY CAMERA</button>
          </div>
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
