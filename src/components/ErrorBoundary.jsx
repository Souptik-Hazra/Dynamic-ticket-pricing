import React, { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(_error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
    
    // Log error to console (could be sent to error tracking service)
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <h2>🎫 Oops! Something went wrong</h2>
            <p>We're sorry, but something unexpected happened.</p>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="error-details">
                <summary>Error Details (Development Only)</summary>
                <pre>{this.state.error.toString()}</pre>
                <pre>{this.state.errorInfo?.componentStack}</pre>
              </details>
            )}
            
            <div className="error-actions">
              <button onClick={this.handleRetry} className="retry-btn">
                Try Again
              </button>
              <button onClick={() => window.location.reload()} className="reload-btn">
                Reload Page
              </button>
            </div>
          </div>
          
          <style>{`
            .error-boundary {
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              padding: 20px;
              background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            }
            .error-boundary-content {
              background: rgba(255, 255, 255, 0.1);
              backdrop-filter: blur(10px);
              border-radius: 16px;
              padding: 40px;
              max-width: 500px;
              text-align: center;
              color: white;
            }
            .error-boundary-content h2 {
              margin-bottom: 16px;
              font-size: 24px;
            }
            .error-boundary-content p {
              color: rgba(255, 255, 255, 0.7);
              margin-bottom: 24px;
            }
            .error-details {
              text-align: left;
              margin: 16px 0;
              padding: 12px;
              background: rgba(0, 0, 0, 0.3);
              border-radius: 8px;
              font-size: 12px;
              max-height: 200px;
              overflow: auto;
            }
            .error-details pre {
              white-space: pre-wrap;
              word-break: break-word;
              color: #ff6b6b;
            }
            .error-actions {
              display: flex;
              gap: 12px;
              justify-content: center;
            }
            .retry-btn, .reload-btn {
              padding: 12px 24px;
              border: none;
              border-radius: 8px;
              cursor: pointer;
              font-weight: 600;
              transition: transform 0.2s, opacity 0.2s;
            }
            .retry-btn {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
            }
            .reload-btn {
              background: rgba(255, 255, 255, 0.2);
              color: white;
            }
            .retry-btn:hover, .reload-btn:hover {
              transform: translateY(-2px);
              opacity: 0.9;
            }
          `}</style>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
