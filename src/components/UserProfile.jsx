import React, { useState, useEffect } from "react";
import NotificationBell from "./NotificationBell";
import axios from "axios";
import { useAuth } from "../context/AuthContext.jsx";
import { API_URL } from "../config/api";
import "./UserProfile.css";

const UserProfile = () => {
  const { user, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState("profile");
  // Demo notifications; replace with API call for real notifications
  const [notifications] = useState([
    { message: "Welcome to the platform!", time: "Just now", read: false },
    { message: "Your ticket for SJT Marathon is confirmed.", time: "1h ago", read: true },
  ]);
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

  useEffect(() => {
    if (activeTab === "tickets") {
      fetchTickets();
    }
  }, [activeTab]);

  const fetchTickets = async () => {
    try {
      setTicketsLoading(true);
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_URL}/tickets`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTickets(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error("Error fetching tickets:", err);
    } finally {
      setTicketsLoading(false);
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
    <div className="profile-page">
      {/* Header Card */}
      <div className="profile-header-card">
        <div className="profile-header-bg"></div>
        <div className="profile-header-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div className="profile-avatar">{getInitials(user?.name)}</div>
            <div className="profile-header-info">
              <h1 className="profile-display-name">{user?.name || "User"}</h1>
              <p className="profile-email">{user?.email}</p>
              <div className="profile-meta">
                <span className="profile-badge">
                  {user?.role === "admin" ? "👑 Admin" : "🎫 Member"}
                </span>
                {user?.subscription?.plan && user?.subscription?.plan !== 'none' && (
                  <span className="profile-badge subscription-badge" style={{background: '#2ecc71', color: 'black', marginLeft: '10px'}}>
                    ⭐ {user.subscription.plan.replace(/_/g, ' ').toUpperCase()}
                  </span>
                )}
                <span className="profile-member-since">
                  Member since {getMemberSince()}
                </span>
              </div>
            </div>
          </div>
          {/* Notification Bell */}
          <NotificationBell notifications={notifications} />
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="profile-tabs">
        <button
          className={`profile-tab ${activeTab === "profile" ? "active" : ""}`}
          onClick={() => setActiveTab("profile")}
        >
          <span className="tab-icon">👤</span> Edit Profile
        </button>
        <button
          className={`profile-tab ${activeTab === "tickets" ? "active" : ""}`}
          onClick={() => setActiveTab("tickets")}
        >
          <span className="tab-icon">🎟️</span> My Tickets
        </button>
      </div>

      {/* Profile Edit Tab */}
      {activeTab === "profile" && (
        <div className="profile-card">
          <h2 className="card-title">Personal Information</h2>
          <p className="card-subtitle">Update your account details</p>

          {message.text && (
            <div className={`profile-message ${message.type}`}>
              {message.type === "success" ? "✅" : "❌"} {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="profile-form">
            <div className="form-row-profile">
              <div className="form-group-profile">
                <label htmlFor="name">Full Name</label>
                <div className="input-wrapper">
                  <span className="input-icon">👤</span>
                  <input
                    id="name"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Your full name"
                    required
                  />
                </div>
              </div>
              <div className="form-group-profile">
                <label htmlFor="email">Email Address</label>
                <div className="input-wrapper">
                  <span className="input-icon">📧</span>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="your@email.com"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="form-row-profile">
              <div className="form-group-profile">
                <label htmlFor="city">City</label>
                <div className="input-wrapper">
                  <span className="input-icon">📍</span>
                  <input
                    id="city"
                    name="city"
                    value={form.city}
                    onChange={handleChange}
                    placeholder="Your city"
                  />
                </div>
              </div>
              <div className="form-group-profile">
                <label htmlFor="birthdate">Date of Birth</label>
                <div className="input-wrapper">
                  <span className="input-icon">🎂</span>
                  <input
                    id="birthdate"
                    name="birthdate"
                    type="date"
                    value={form.birthdate}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            <div className="form-group-profile">
              <label htmlFor="password">New Password</label>
              <div className="input-wrapper">
                <span className="input-icon">🔒</span>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Leave blank to keep current password"
                  minLength={8}
                />
              </div>
              <small className="field-hint">
                Minimum 8 characters with at least one letter and one number
              </small>
            </div>

            <button type="submit" className="profile-save-btn" disabled={loading}>
              {loading ? (
                <span className="btn-loading">
                  <span className="spinner-small"></span> Saving...
                </span>
              ) : (
                "Save Changes"
              )}
            </button>
          </form>
        </div>
      )}

      {/* Tickets Tab */}
      {activeTab === "tickets" && (
        <div className="profile-card">
          <div className="tickets-header">
            <div>
              <h2 className="card-title">My Tickets</h2>
              <p className="card-subtitle">Your booking history</p>
            </div>
            <button className="refresh-tickets-btn" onClick={fetchTickets}>
              🔄 Refresh
            </button>
          </div>

          {ticketsLoading ? (
            <div className="tickets-loading">
              <div className="spinner-large"></div>
              <p>Loading your tickets...</p>
            </div>
          ) : tickets.length === 0 ? (
            <div className="no-tickets">
              <div className="no-tickets-icon">🎫</div>
              <h3>No tickets yet</h3>
              <p>Your purchased tickets will appear here</p>
            </div>
          ) : (
            <div className="tickets-list">
              {tickets.map((ticket) => (
                <div key={ticket._id} className="ticket-card-profile">
                  <div className="ticket-left">
                    <div className="ticket-event-name">
                      {ticket.eventId?.name || "Event"}
                    </div>
                    <div className="ticket-details-row">
                      <span className="ticket-detail">
                        🎟️ {ticket.categoryName?.toUpperCase() || "STANDARD"}
                      </span>
                      <span className="ticket-detail">× {ticket.quantity}</span>
                      <span className="ticket-detail">
                        📅{" "}
                        {new Date(ticket.purchaseDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    {ticket.bookingReference && (
                      <div className="ticket-ref">Ref: {ticket.bookingReference}</div>
                    )}
                  </div>
                  <div className="ticket-right">
                    <div className="ticket-amount">
                      ₹{ticket.totalAmount?.toFixed(2)}
                    </div>
                    <span className={`ticket-status ${ticket.status || "confirmed"}`}>
                      {ticket.status || "confirmed"}
                    </span>
                    <button
                      className="print-ticket-btn"
                      onClick={() => handlePrintTicket(ticket)}
                      title="Print / Save as PDF"
                    >
                      🖨️ Print
                    </button>
                  </div>
                </div>
              ))}

              <div className="tickets-summary-profile">
                <div className="summary-item">
                  <span className="summary-label">Total Bookings</span>
                  <span className="summary-value">{tickets.length}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Total Tickets</span>
                  <span className="summary-value">
                    {tickets.reduce((sum, t) => sum + (t.quantity || 0), 0)}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Total Spent</span>
                  <span className="summary-value">
                    ₹{tickets.reduce((sum, t) => sum + (t.totalAmount || 0), 0).toFixed(2)}
                  </span>
                </div>
              </div>
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
              {printTicket.eventId?.image && (
                <div className="print-event-image">
                  <img
                    src={printTicket.eventId.image}
                    alt={printTicket.eventId?.name}
                    onError={(e) => (e.target.style.display = "none")}
                  />
                </div>
              )}

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
                    <span className="print-box-value print-ref">
                      {printTicket.bookingReference || printTicket._id}
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
    </div>
  );
};

export default UserProfile;
