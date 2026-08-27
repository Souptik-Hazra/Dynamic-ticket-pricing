import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';
import './GeminiChatbot.css';

const QUICK_PROMPTS = [
  "💡 Why did ticket prices increase for concerts?",
  "❄️ How does Cold-Start pricing work?",
  "🤖 Explain XGBoost vs BERT hype signals",
  "🎫 Is Diljit Dosanjh concert in high demand?"
];

const GeminiChatbot = ({ selectedEvent }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'model',
      text: '✨ Hello! I am your Gemini GenAI Pricing Assistant. Ask me how XGBoost & BERT determine dynamic ticket prices or why prices changed!'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async (textToSend) => {
    const query = textToSend || input;
    if (!query.trim() || loading) return;

    const userMsg = { role: 'user', text: query };
    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/chat/ask`, {
        message: query,
        eventId: selectedEvent?._id
      });

      const aiMsg = {
        role: 'model',
        text: response.data.answer || 'I am processing price insights for this event.'
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      console.error('Chatbot error:', err);
      setMessages(prev => [
        ...prev,
        {
          role: 'model',
          text: '⚠️ Unable to connect to Gemini AI Assistant right now. Please try again shortly.'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="gemini-chatbot-wrapper">
      {/* Floating Trigger Button */}
      <button 
        className="gemini-chat-toggle"
        onClick={() => setIsOpen(!isOpen)}
        title="Gemini AI Pricing Assistant"
      >
        <span className="gemini-badge-glow">✨</span>
        <span className="gemini-toggle-label">Gemini AI</span>
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="gemini-chat-window">
          {/* Header */}
          <div className="gemini-chat-header">
            <div className="gemini-header-info">
              <span className="gemini-ai-icon">🤖</span>
              <div>
                <h4>Gemini AI Assistant</h4>
                <p>Natural Language Dynamic Pricing Insights</p>
              </div>
            </div>
            <button className="gemini-close-btn" onClick={() => setIsOpen(false)}>✕</button>
          </div>

          {/* Context Event Banner */}
          {selectedEvent && (
            <div className="gemini-event-context">
              📍 Context: <strong>{selectedEvent.name}</strong> (Current: ₹{selectedEvent.currentPrice})
            </div>
          )}

          {/* Chat Messages */}
          <div className="gemini-chat-body">
            {messages.map((msg, index) => (
              <div key={index} className={`gemini-msg-row ${msg.role}`}>
                <div className="gemini-msg-bubble">
                  {msg.text}
                </div>
              </div>
            ))}

            {loading && (
              <div className="gemini-msg-row model">
                <div className="gemini-msg-bubble loading-dots">
                  <span>.</span><span>.</span><span>.</span> Gemini analyzing demand
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          <div className="gemini-quick-prompts">
            {QUICK_PROMPTS.map((prompt, idx) => (
              <button key={idx} className="quick-chip" onClick={() => handleSend(prompt)}>
                {prompt}
              </button>
            ))}
          </div>

          {/* Input Form */}
          <form className="gemini-chat-footer" onSubmit={(e) => { e.preventDefault(); handleSend(); }}>
            <input
              type="text"
              placeholder="Ask Gemini about pricing..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
            />
            <button type="submit" disabled={loading || !input.trim()}>
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default GeminiChatbot;
