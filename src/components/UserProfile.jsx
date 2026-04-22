import React, { useState, useEffect } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext.jsx";
import { ENDPOINTS } from "../config/api";
import { useWebSocket } from "../hooks/useWebSocket";

const UserProfile = () => {
  const { user, updateUser } = useAuth();
  const { lastEvent } = useWebSocket();
  const [activeTab, setActiveTab] = useState("profile");
  const [form, setForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    password: "",
    city: user?.city || "",
    birthdate: user?.birthdate ? user.birthdate.substring(0, 10) : "",
  });
  const [message, setMessage] = useState({ text: "", type: "" });
  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [printTicket, setPrintTicket] = useState(null);
  const [payments, setPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [refundingId, setRefundingId] = useState(null);
  const [wallet, setWallet] = useState({ balance: 0, transactions: [] });
  const [walletLoading, setWalletLoading] = useState(false);

  const fetchWallet = async () => {
    try {
      setWalletLoading(true);
      const { data } = await api.get(ENDPOINTS.WALLET_BALANCE);
      setWallet(data);
    } catch (err) {
      console.error("Error fetching wallet:", err);
    } finally {
      setWalletLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "tickets") fetchTickets();
    if (activeTab === "payments") fetchPayments();
    fetchWallet(); // Always fetch wallet balance on mount/refresh
  }, [activeTab]);

  const handleDeposit = async () => {
    const amount = window.prompt("Enter amount to add to your wallet (₹):", "500");
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) return;

    try {
      setWalletLoading(true);
      await api.post(ENDPOINTS.WALLET_DEPOSIT,
        { amount: parseFloat(amount) }
      );
      alert(`₹${amount} added to your wallet successfully!`);
      fetchWallet();
    } catch (err) {
      console.error("Deposit error:", err);
      alert(err.response?.data?.error || "Failed to add money");
    } finally {
      setWalletLoading(false);
    }
  };

  const handleWithdraw = async () => {
    const amount = window.prompt("Enter amount to withdraw from your wallet (₹):", "100");
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) return;

    if (parseFloat(amount) > wallet.balance) {
      alert("Insufficient balance!");
      return;
    }

    try {
      setWalletLoading(true);
      await api.post(ENDPOINTS.WALLET_WITHDRAW,
        { amount: parseFloat(amount) }
      );
      alert(`₹${amount} withdrawn from your wallet successfully!`);
      fetchWallet();
    } catch (err) {
      console.error("Withdrawal error:", err);
      alert(err.response?.data?.error || "Failed to withdraw money");
    } finally {
      setWalletLoading(false);
    }
  };

  // Real-time: refresh ticket list when a new ticket_sold event arrives
  useEffect(() => {
    if (lastEvent?.type === 'ticket_sold') {
      if (activeTab === 'tickets') fetchTickets();
      fetchWallet();
    }
    if (lastEvent?.type === 'notification') {
      fetchWallet();
    }
  }, [lastEvent]); // eslint-disable-line

  const fetchTickets = async () => {
    try {
      setTicketsLoading(true);
      const response = await api.get(ENDPOINTS.USER_TICKETS);
      setTickets(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error("Error fetching tickets:", err);
    } finally {
      setTicketsLoading(false);
    }
  };

  const fetchPayments = async () => {
    try {
      setPaymentsLoading(true);
      const { data } = await api.get(ENDPOINTS.PAYMENTS);
      console.log("[UserProfile] Payments loaded:", data);

      // Handle various response structures gracefully
      let paymentsList = [];
      if (data && Array.isArray(data.payments)) {
        paymentsList = data.payments;
      } else if (Array.isArray(data)) {
        paymentsList = data;
      } else if (data && data.success && Array.isArray(data.payments)) {
        paymentsList = data.payments;
      }

      setPayments(paymentsList);
    } catch (err) {
      console.error("Error fetching payments:", err);
    } finally {
      setPaymentsLoading(false);
    }
  };

  const handleRefund = async (paymentId) => {
    if (!window.confirm("Warning: Organiser/Admin will keep a 15% cancellation fee, and you will receive an 85% refund. Are you convinced now?")) return;
    try {
      setRefundingId(paymentId);
      await api.post(
        ENDPOINTS.PAYMENT_REFUND(paymentId),
        {}
      );
      await fetchPayments(); // refresh list
    } catch (err) {
      alert(err.response?.data?.error || 'Refund request failed');
    } finally {
      setRefundingId(null);
    }
  };


  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setMessage({ text: "", type: "" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const dataToSend = { ...form };
      if (!dataToSend.password) delete dataToSend.password;
      await updateUser(dataToSend);
      setMessage({ text: "Profile updated successfully!", type: "success" });
      setForm((prev) => ({ ...prev, password: "" }));
    } catch (err) {
      const errorMsg =
        err.response?.data?.error || "Error updating profile. Please try again.";
      setMessage({ text: errorMsg, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getMemberSince = () => {
    if (!user?.createdAt) return "Recently";
    return new Date(user.createdAt).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  };

  const handlePrintTicket = (ticket) => {
    setPrintTicket(ticket);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  return (
    <div className="cyber-container animate-fade-up" style={{ padding: '2rem 0' }}>
      {/* Header Profile Section */}
      <header className="flex-between" style={{ marginBottom: '3rem', alignItems: 'flex-start' }}>
        <div className="flex-center" style={{ justifyContent: 'flex-start', gap: '2rem' }}>
          <div className="cyber-avatar">
            {getInitials(user?.name)}
          </div>
          <div>
            <h1 className="title-main text-gradient" style={{ margin: 0 }}>{user?.name || "Citizen"}</h1>
            <p className="text-muted" style={{ marginBottom: '0.5rem' }}>{user?.email}</p>
            <div className="flex-center" style={{ justifyContent: 'flex-start', gap: '0.8rem' }}>
              <span className="cyber-badge badge-info">{user?.role?.toUpperCase()}</span>
              {user?.subscription?.plan && user?.subscription?.plan !== 'none' && (
                <span className="cyber-badge badge-success">⭐ {user.subscription.plan.toUpperCase()}</span>
              )}
            </div>
          </div>
        </div>

        <div className="cyber-card" style={{ padding: '1rem 2rem', minWidth: '250px' }}>
          <span className="cyber-label" style={{ fontSize: '0.7rem', display: 'block', marginBottom: '0.5rem' }}>Neural Wallet Balance</span>
          <div className="flex-between">
            <span className="text-glow" style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--success)' }}>
              ₹{wallet.balance?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
            <div className="flex-center" style={{ gap: '0.5rem' }}>
              <button className="cyber-btn btn-outline" style={{ padding: '0.4rem' }} onClick={handleDeposit} title="Deposit">➕</button>
              <button className="cyber-btn btn-outline" style={{ padding: '0.4rem' }} onClick={handleWithdraw} title="Withdraw">💸</button>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs Navigation */}
      <nav className="cyber-tabs">
        {[
          { id: 'profile', label: '👤 Profile Info' },
          { id: 'tickets', label: '🎟️ My Bookings' },
          { id: 'payments', label: '💳 Financial Logs' }
        ].map(tab => (
          <button
            key={tab.id}
            className={`cyber-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Content Area */}
      <main>
        {/* Profile Info */}
        {activeTab === "profile" && (
          <div className="cyber-card animate-fade-up" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h2 className="title-sub">Personal Protocols</h2>
            {message.text && (
              <div className={`cyber-badge ${message.type === 'success' ? 'badge-success' : 'badge-danger'}`} style={{ width: '100%', padding: '1rem', marginBottom: '2rem' }}>
                {message.text}
              </div>
            )}
            <form onSubmit={handleSubmit} className="flex-column" style={{ gap: '1.5rem' }}>
              <div className="cyber-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="cyber-form-group">
                  <label className="cyber-label">Full Name</label>
                  <input className="cyber-input" type="text" name="name" value={form.name} readOnly />
                </div>
                <div className="cyber-form-group">
                  <label className="cyber-label">Email Address</label>
                  <input className="cyber-input" type="email" name="email" value={form.email} readOnly />
                </div>
              </div>

              <div className="cyber-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="cyber-form-group">
                  <label className="cyber-label">Base City</label>
                  <input className="cyber-input" type="text" name="city" value={form.city} onChange={handleChange} placeholder="Neural Hub" />
                </div>
                <div className="cyber-form-group">
                  <label className="cyber-label">Origin Date (DOB)</label>
                  <input className="cyber-input" type="date" name="birthdate" value={form.birthdate} onChange={handleChange} />
                </div>
              </div>

              <div className="cyber-form-group">
                <label className="cyber-label">New Protocol Access (Password)</label>
                <input className="cyber-input" type="password" name="password" value={form.password} onChange={handleChange} placeholder="Leave blank to maintain current" />
              </div>

              <button type="submit" className="cyber-btn btn-primary" style={{ padding: '1.2rem', marginTop: '1rem' }} disabled={loading}>
                {loading ? 'SYNCHRONIZING...' : 'UPDATE PROFILE'}
              </button>
            </form>
          </div>
        )}

        {/* Tickets */}
        {activeTab === "tickets" && (
          <div className="animate-fade-up">
            <div className="flex-between" style={{ marginBottom: '2rem' }}>
              <h2 className="title-sub" style={{ margin: 0 }}>Secure Reservations</h2>
              <button className="cyber-btn btn-outline" onClick={fetchTickets}>🔄 Sync</button>
            </div>

            {ticketsLoading ? (
              <div className="flex-center" style={{ padding: '5rem' }}>
                <div className="cyber-pulse text-glow">Fetching encrypted ticket data...</div>
              </div>
            ) : tickets.length === 0 ? (
              <div className="flex-center" style={{ padding: '5rem', border: '1px dashed var(--border-dim)', borderRadius: '20px' }}>
                <p className="text-dim">No active reservations found in your sector.</p>
              </div>
            ) : (
              <div className="cyber-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))' }}>
                {tickets.map(ticket => (
                  <div key={ticket._id} className="cyber-card flex-column" style={{ gap: '1rem' }}>
                    <div className="flex-between">
                      <span className="cyber-label" style={{ fontSize: '0.65rem' }}>{ticket.bookingReference}</span>
                      <span className={`cyber-badge badge-${ticket.status || 'success'}`}>{ticket.status?.toUpperCase() || 'CONFIRMED'}</span>
                    </div>
                    <h3 className="text-main" style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0 }}>{ticket.eventId?.name || "Event"}</h3>
                    <div className="flex-column" style={{ gap: '0.5rem' }}>
                      <div className="flex-between text-dim" style={{ fontSize: '0.85rem' }}>
                        <span>Tier: {ticket.categoryName?.toUpperCase()}</span>
                        <span>Qty: {ticket.quantity}</span>
                      </div>
                      <div className="flex-between text-main" style={{ fontWeight: '700' }}>
                        <span>Paid: ₹{ticket.totalAmount?.toLocaleString()}</span>
                        <span>Date: {new Date(ticket.purchaseDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <button className="cyber-btn btn-outline" style={{ width: '100%', marginTop: '0.5rem' }} onClick={() => handlePrintTicket(ticket)}>
                      🖨️ VIEW DIGITAL PASS
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {/* Print Ticket Modal (hidden on screen, visible on print) */}
        {printTicket && (
          <div className="print-overlay" onClick={() => setPrintTicket(null)}>
            <div className="print-ticket-modal" onClick={(e) => e.stopPropagation()}>
              <button className="print-modal-close" onClick={() => setPrintTicket(null)}>×</button>
              <div className="print-ticket-content" id="printable-ticket">
                {/* Header */}
                <div className="print-ticket-header">
                  <div className="print-ticket-brand">
                    <span className="print-brand-icon">🎫</span>
                    <span className="print-brand-name">FanFeverTickets</span>
                  </div>
                  <div className="print-ticket-title">E-TICKET</div>
                </div>

                {/* Event Image */}
                <div className="print-event-image">
                  <img
                    src={printTicket.eventId?.image || '/default-event.png'}
                    alt={printTicket.eventId?.name}
                    onError={(e) => (e.target.src = "/default-event.png")}
                  />
                </div>

                {/* Event Info */}
                <div className="print-event-info">
                  <h2 className="print-event-name">{printTicket.eventId?.name || "Event"}</h2>
                  <div className="print-event-details">
                    {printTicket.eventId?.venue && (
                      <div className="print-detail-row">
                        <span className="print-detail-label">📍 Venue</span>
                        <span className="print-detail-value">{printTicket.eventId.venue}</span>
                      </div>
                    )}
                    {printTicket.eventId?.startDate && (
                      <div className="print-detail-row">
                        <span className="print-detail-label">📅 Date</span>
                        <span className="print-detail-value">
                          {new Date(printTicket.eventId.startDate).toLocaleDateString("en-US", {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                          {printTicket.eventId.endDate &&
                            printTicket.eventId.endDate !== printTicket.eventId.startDate &&
                            ` — ${new Date(printTicket.eventId.endDate).toLocaleDateString("en-US", {
                              weekday: "long",
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}`}
                        </span>
                      </div>
                    )}
                    {printTicket.eventId?.category && (
                      <div className="print-detail-row">
                        <span className="print-detail-label">🎭 Category</span>
                        <span className="print-detail-value">
                          {printTicket.eventId.category.charAt(0).toUpperCase() +
                            printTicket.eventId.category.slice(1)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Divider */}
                <div className="print-divider"></div>

                {/* Ticket Details */}
                <div className="print-ticket-details">
                  <div className="print-detail-grid">
                    <div className="print-detail-box">
                      <span className="print-box-label">Booking Reference</span>
                      <span className="print-box-value print-ref" style={{ color: '#fff' }}>
                        {printTicket.bookingReference || printTicket._id || "N/A"}
                      </span>
                    </div>
                    <div className="print-detail-box">
                      <span className="print-box-label">Ticket Type</span>
                      <span className="print-box-value">
                        {printTicket.categoryName?.toUpperCase() || "STANDARD"}
                      </span>
                    </div>
                    <div className="print-detail-box">
                      <span className="print-box-label">Quantity</span>
                      <span className="print-box-value">{printTicket.quantity}</span>
                    </div>
                    <div className="print-detail-box">
                      <span className="print-box-label">Price per Ticket</span>
                      <span className="print-box-value">
                        ₹{printTicket.price?.toFixed(2) || (printTicket.totalAmount / printTicket.quantity).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* QR Code Section */}
                  {printTicket.qrCode && (
                    <div className="pp-qr-section" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '20px 0' }}>
                      <img src={printTicket.qrCode} alt="Ticket QR Code" style={{ width: '150px', height: '150px', background: 'white', padding: '10px', borderRadius: '8px' }} />
                      <p style={{ marginTop: '10px', fontSize: '0.8rem', color: '#666' }}>Scan at entrance for entry</p>
                    </div>
                  )}

                  <div className="print-total-section">
                    <div className="print-total-row">
                      <span>Total Amount Paid</span>
                      <span className="print-total-amount">
                        ₹{printTicket.totalAmount?.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="print-divider"></div>

                {/* Customer Info */}
                <div className="print-customer-info">
                  <div className="print-detail-row">
                    <span className="print-detail-label">👤 Name</span>
                    <span className="print-detail-value">
                      {printTicket.customerName || user?.name || "N/A"}
                    </span>
                  </div>
                  <div className="print-detail-row">
                    <span className="print-detail-label">📧 Email</span>
                    <span className="print-detail-value">
                      {printTicket.customerEmail || user?.email || "N/A"}
                    </span>
                  </div>
                  <div className="print-detail-row">
                    <span className="print-detail-label">📅 Purchased</span>
                    <span className="print-detail-value">
                      {new Date(printTicket.purchaseDate).toLocaleString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="print-detail-row">
                    <span className="print-detail-label">✅ Status</span>
                    <span className="print-detail-value print-status-confirmed">
                      {(printTicket.status || "confirmed").toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Footer */}
                <div className="print-ticket-footer">
                  <p>This is a computer-generated ticket. No signature required.</p>
                  <p>Transaction ID: {printTicket._id}</p>
                </div>
              </div>

              <div className="print-modal-actions">
                <button className="print-now-btn" onClick={() => window.print()}>
                  🖨️ Print / Save as PDF
                </button>
                <button className="print-cancel-btn" onClick={() => setPrintTicket(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
        {/* \u2500\u2500 Payments Tab \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */}
        {/* Payments */}
        {activeTab === "payments" && (
          <div className="animate-fade-up">
            <div className="flex-between" style={{ marginBottom: '2rem' }}>
              <h2 className="title-sub" style={{ margin: 0 }}>Neural Transaction History</h2>
              <button className="cyber-btn btn-outline" onClick={fetchPayments}>🔄 Refresh Logs</button>
            </div>

            {paymentsLoading ? (
              <div className="flex-center" style={{ padding: '5rem' }}>
                <div className="animate-pulse text-glow">Retrieving ledger entries...</div>
              </div>
            ) : payments.length === 0 ? (
              <div className="flex-center" style={{ padding: '5rem', border: '1px dashed var(--border-dim)', borderRadius: '20px' }}>
                <p className="text-dim">No transactions recorded on the ledger.</p>
              </div>
            ) : (
              <div className="cyber-table-container">
                <table className="cyber-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Reference / Link</th>
                      <th>Channel</th>
                      <th>Magnitude</th>
                      <th>State</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p._id}>
                        <td>{new Date(p.createdAt).toLocaleDateString()}</td>
                        <td>
                          <div className="text-main" style={{ fontWeight: '700' }}>{p.eventId?.name || 'Platform Service'}</div>
                          <div className="text-dim" style={{ fontSize: '0.7rem' }}>{p.transactionId || p._id}</div>
                        </td>
                        <td>
                          <span className="text-dim">{p.paymentMethod?.toUpperCase()}</span>
                        </td>
                        <td className="text-glow" style={{ fontWeight: '800', color: 'var(--success)' }}>₹{p.amount?.toFixed(2)}</td>
                        <td>
                          <span className={`cyber-badge badge-${p.status}`}>{p.status.toUpperCase()}</span>
                        </td>
                        <td>
                          {p.status === 'completed' && (
                            <button className="cyber-btn btn-danger" style={{ padding: '0.4rem 0.8rem', fontSize: '0.7rem' }} onClick={() => handleRefund(p._id)} disabled={refundingId === p._id}>
                              {refundingId === p._id ? '...' : 'REFUND'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default UserProfile;
