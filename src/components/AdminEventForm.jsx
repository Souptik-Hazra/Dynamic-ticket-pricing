import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { ENDPOINTS } from '../config/api';
import VenueLayoutDesigner from './VenueLayoutDesigner';
import SeatGridPreview from './SeatGridPreview';

function AdminEventForm({ event, onClose }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    venue: '',
    startDate: '',
    endDate: '',
    eventPopularity: 0.5,
    category: 'concert',
    image: '/default-event.png',
    status: 'upcoming',
    venueTier: 2,
    artistTier: 0,
    isHoliday: false
  });
  
  const [ticketCategories, setTicketCategories] = useState([
    { name: '', price: '', maxPrice: '', seats: '', availableSeats: undefined, color: '' }
  ]);
  const [venueLayoutType, setVenueLayoutType] = useState('none');
  const [stagePosition, setStagePosition] = useState('bottom');
  const [venueMetrics, setVenueMetrics] = useState({
    exitsCount: 4,
    aisleWidth: 'standard',
    securitySpeed: 'normal'
  });
  const [seatMap, setSeatMap] = useState([]);
  const [safetyScores, setSafetyScores] = useState({});
  const [isSafetyMode, setIsSafetyMode] = useState(false);
  const [activeCategory, setActiveCategory] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Helper function to compute status based on dates
  const computeStatus = (startDate, endDate) => {
    if (!startDate) return 'upcoming';
    
    const now = new Date();
    const start = new Date(startDate);
    // Treat endDate as end-of-day (23:59:59) so same-day events stay "ongoing" all day
    const end = endDate ? new Date(endDate) : new Date(start);
    end.setHours(23, 59, 59, 999);
    
    if (now < start) {
      return 'upcoming';
    } else if (now >= start && now <= end) {
      return 'ongoing';
    } else {
      return 'completed';
    }
  };

  useEffect(() => {
    const syncTimer = setTimeout(() => {
      if (event) {
        // Clear any existing errors when loading edit data
        setError('');
        
        // Format start and end date for datetime-local input
        const startDate = event.startDate ? new Date(event.startDate).toISOString().slice(0, 16) : '';
        const endDate = event.endDate ? new Date(event.endDate).toISOString().slice(0, 16) : '';
        // Auto-compute status based on dates (preserve 'cancelled' status)
        const autoStatus = event.status === 'cancelled' ? 'cancelled' : computeStatus(startDate, endDate);
        
        setFormData({
          name: event.name,
          description: event.description,
          venue: event.venue,
          startDate,
          endDate,
          eventPopularity: event.eventPopularity || 0.5,
          category: event.category,
          image: event.image,
          status: autoStatus,
          venueTier: event.venueTier || 2,
          artistTier: event.artistTier || 3,
          isHoliday: event.isHoliday || false
        });

        // Load venue layout settings
        setVenueLayoutType(event.venueLayoutType || 'none');
        setStagePosition(event.stagePosition || 'bottom');
        if (event.venueMetrics) {
          setVenueMetrics(event.venueMetrics);
        }
        if (event.seatMap) {
          setSeatMap(event.seatMap);
        }
        
        // Set ticket categories if they exist
        if (event.ticketCategories && event.ticketCategories.length > 0) {
          setTicketCategories(event.ticketCategories.map(cat => ({
            name: cat.name,
            price: cat.price,
            maxPrice: cat.maxPrice || cat.price * 2,
            seats: cat.seats,
            availableSeats: cat.availableSeats, // Preserve available seats
            bookedSeats: cat.bookedSeats || [], // Preserve exact ticket ids
            color: cat.color || '',
          })));
        } else if (event.basePrice || event.capacity) {
          // Handle old events without ticketCategories - create a default one
          setTicketCategories([{
            name: 'standard',
            price: event.basePrice || '',
            maxPrice: event.basePrice ? event.basePrice * 2 : '',
            seats: event.capacity || '',
            availableSeats: event.availableTickets || event.capacity || undefined
          }]);
        }
      }
    }, 0);
    return () => clearTimeout(syncTimer);
  }, [event]);

  // Auto-update status in background every minute
  useEffect(() => {
    const updateStatusAutomatically = () => {
      if (formData.status !== 'cancelled' && formData.startDate) {
        const newStatus = computeStatus(formData.startDate, formData.endDate);
        if (newStatus !== formData.status) {
          setFormData(prev => ({ ...prev, status: newStatus }));
        }
      }
    };

    // Check every minute
    const interval = setInterval(updateStatusAutomatically, 60000);
    return () => clearInterval(interval);
  }, [formData.startDate, formData.endDate, formData.status]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    setFormData(prev => {
      const newData = {
        ...prev,
        [name]: value
      };
      
      // Auto-update status when dates change (skip if status is 'cancelled')
      if ((name === 'startDate' || name === 'endDate') && prev.status !== 'cancelled') {
        const startDate = name === 'startDate' ? value : prev.startDate;
        const endDate = name === 'endDate' ? value : prev.endDate;
        newData.status = computeStatus(startDate, endDate);
      }
      
      return newData;
    });
    setError('');
  };
  
  const handleCategoryChange = (index, field, value) => {
    const newCategories = [...ticketCategories];
    newCategories[index][field] = value;
    setTicketCategories(newCategories);
    setError('');
  };
  
  const addTicketCategory = () => {
    setTicketCategories([...ticketCategories, { name: '', price: '', maxPrice: '', seats: '', availableSeats: undefined, color: '', bookedSeats: [] }]);
  };

  const handleCategoryColorChange = (index, color) => {
    const newCategories = [...ticketCategories];
    newCategories[index].color = color;
    setTicketCategories(newCategories);
  };

  const handleCategoryBlockedSeatsChange = (index, newBlockedSeats) => {
    const newCategories = [...ticketCategories];
    newCategories[index].blockedSeats = newBlockedSeats;
    setTicketCategories(newCategories);
  };
  
  const removeTicketCategory = (index) => {
    if (ticketCategories.length > 1) {
      setTicketCategories(ticketCategories.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.name || !formData.venue || !formData.startDate) {
      setError('Please fill all required fields');
      return;
    }
    
    // Validate ticket categories - check for actual values (numbers or non-empty strings)
    const validCategories = ticketCategories.filter(cat => {
      const hasName = cat.name && cat.name.trim() !== '';
      const hasPrice = cat.price !== '' && cat.price !== null && cat.price !== undefined;
      const hasSeats = cat.seats !== '' && cat.seats !== null && cat.seats !== undefined;
      return hasName && hasPrice && hasSeats;
    });
    if (validCategories.length === 0) {
      setError('Please add at least one ticket category with name, price and seats');
      return;
    }

    setLoading(true);

    try {
      const eventData = {
        ...formData,
        eventPopularity: parseFloat(formData.eventPopularity),
        venueTier: parseInt(formData.venueTier),
        artistTier: parseInt(formData.artistTier),
        isHoliday: formData.isHoliday === true || formData.isHoliday === 'true',
        venueLayoutType,
        stagePosition,
        venueMetrics,
        ticketCategories: validCategories.map(cat => ({
          name: cat.name,
          price: parseFloat(cat.price),
          maxPrice: cat.maxPrice ? parseFloat(cat.maxPrice) : parseFloat(cat.price) * 2,
          seats: parseInt(cat.seats),
          availableSeats: cat.availableSeats !== undefined ? parseInt(cat.availableSeats) : parseInt(cat.seats),
          bookedSeats: cat.bookedSeats || [],
          color: cat.color || '',
        })),
        seatMap
      };

      if (event) {
        const updateUrl = isAdmin 
          ? `${ENDPOINTS.ADMIN_EVENTS}/${event._id}` 
          : `${ENDPOINTS.EVENTS}/${event._id}`;
        await api.put(updateUrl, eventData);
        alert('Event updated successfully!');
      } else {
        const createUrl = isAdmin 
          ? ENDPOINTS.ADMIN_EVENTS 
          : ENDPOINTS.EVENTS;
        await api.post(createUrl, eventData);
        alert('Event created successfully!');
      }

      onClose(true); // Close and refresh
    } catch (error) {
      console.error('Form error:', error);
      setError(error.response?.data?.error || 'Failed to save event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cyber-overlay animate-fade-up" onClick={(e) => {
      if (e.target.className.includes('cyber-overlay')) onClose(false);
    }}>
      <div className="cyber-modal animate-fade-up" style={{ maxWidth: '1400px' }}>
        <header className="modal-header">
          <h2 className="text-gradient" style={{ fontSize: '1.5rem', fontWeight: '900', margin: 0 }}>
            {event ? '🧬 MODIFY PRODUCTION' : '⚡ INITIALIZE NEW PRODUCTION'}
          </h2>
          <button className="cyber-btn btn-outline" style={{ padding: '0.5rem', borderRadius: '50%' }} onClick={() => onClose(false)}>&times;</button>
        </header>

        <div className="modal-content">
          {error && (
            <div className="cyber-badge badge-danger" style={{ width: '100%', padding: '1rem', marginBottom: '2rem' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="cyber-grid" style={{ gridTemplateColumns: '1.2fr 1fr', gap: '3rem', alignItems: 'start' }}>
            {/* Left Panel: Primary Protocols */}
            <div className="flex-column" style={{ gap: '2rem' }}>
              <section className="cyber-card" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <h3 className="cyber-label" style={{ marginBottom: '1.5rem', color: 'var(--accent-cyan)' }}>Core Protocols</h3>
                
                <div className="cyber-form-group">
                  <label className="cyber-label">Event Designation</label>
                  <input className="cyber-input" type="text" name="name" value={formData.name} onChange={handleChange} required placeholder="Production Name" />
                </div>

                <div className="cyber-form-group">
                  <label className="cyber-label">Mission Briefing (Description)</label>
                  <textarea className="cyber-input" name="description" value={formData.description} onChange={handleChange} rows="3" required placeholder="Describe the experience..." />
                </div>

                <div className="cyber-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="cyber-form-group">
                    <label className="cyber-label">Deployment Sector (Venue)</label>
                    <input className="cyber-input" type="text" name="venue" value={formData.venue} onChange={handleChange} required placeholder="The Arena" />
                  </div>
                  <div className="cyber-form-group">
                    <label className="cyber-label">Class Category</label>
                    <select className="cyber-input" name="category" value={formData.category} onChange={handleChange} required>
                      <option value="concert">Concert</option>
                      <option value="sports">Sports</option>
                      <option value="theater">Theater</option>
                      <option value="conference">Conference</option>
                      <option value="festival">Festival</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="cyber-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                  <div className="cyber-form-group">
                    <label className="cyber-label">Start Pulse</label>
                    <input className="cyber-input" type="datetime-local" name="startDate" value={formData.startDate} onChange={handleChange} required />
                  </div>
                  <div className="cyber-form-group">
                    <label className="cyber-label">End Pulse</label>
                    <input className="cyber-input" type="datetime-local" name="endDate" value={formData.endDate} onChange={handleChange} />
                  </div>
                  <div className="cyber-form-group">
                    <label className="cyber-label">Active State</label>
                    <select className="cyber-input" name="status" value={formData.status} onChange={handleChange}>
                      <option value="upcoming">Upcoming</option>
                      <option value="ongoing">Ongoing</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
                
                <div className="cyber-form-group" style={{ marginTop: '1.5rem' }}>
                  <label className="cyber-label">Visual Interface (Image URL)</label>
                  <div className="flex-center" style={{ gap: '1rem' }}>
                    <input className="cyber-input" style={{ flex: 1 }} type="text" name="image" value={formData.image} onChange={handleChange} placeholder="https://..." />
                    {formData.image && (
                      <img src={formData.image} alt="Preview" style={{ width: '40px', height: '40px', borderRadius: '4px', objectFit: 'cover', border: '1px solid var(--border-dim)' }} onError={(e) => e.target.src = '/default-event.png'} />
                    )}
                  </div>
                </div>
              </section>

              <section className="cyber-card" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
                  <h3 className="cyber-label" style={{ color: 'var(--accent-indigo)' }}>Reservation Tiers</h3>
                  <button type="button" className="cyber-btn btn-outline" style={{ fontSize: '0.7rem', padding: '0.4rem 0.8rem' }} onClick={addTicketCategory}>
                    ➕ ADD TIER
                  </button>
                </div>

                <div className="flex-column" style={{ gap: '1rem' }}>
                  {ticketCategories.map((category, index) => (
                    <div key={index} className="glass-panel" style={{ padding: '1rem', position: 'relative' }}>
                      <div className="cyber-grid" style={{ gridTemplateColumns: '1.5fr 1fr 1fr 1fr', gap: '0.8rem' }}>
                        <div className="cyber-form-group" style={{ marginBottom: 0 }}>
                          <input className="cyber-input" style={{ fontSize: '0.8rem' }} type="text" value={category.name} onChange={(e) => handleCategoryChange(index, 'name', e.target.value)} placeholder="Tier Name" required />
                        </div>
                        <div className="cyber-form-group" style={{ marginBottom: 0 }}>
                          <input className="cyber-input" style={{ fontSize: '0.8rem' }} type="number" value={category.seats} onChange={(e) => handleCategoryChange(index, 'seats', e.target.value)} placeholder="Units" required />
                        </div>
                        <div className="cyber-form-group" style={{ marginBottom: 0 }}>
                          <input className="cyber-input" style={{ fontSize: '0.8rem' }} type="number" value={category.price} onChange={(e) => handleCategoryChange(index, 'price', e.target.value)} placeholder="₹ Base" required />
                        </div>
                        <div className="cyber-form-group" style={{ marginBottom: 0 }}>
                          <input className="cyber-input" style={{ fontSize: '0.8rem' }} type="number" value={category.maxPrice} onChange={(e) => handleCategoryChange(index, 'maxPrice', e.target.value)} placeholder="₹ Max" />
                        </div>
                      </div>
                      {ticketCategories.length > 1 && (
                        <button type="button" onClick={() => removeTicketCategory(index)} style={{ position: 'absolute', top: '-10px', right: '-10px', background: 'var(--danger)', border: 'none', borderRadius: '50%', width: '20px', height: '20px', color: 'white', cursor: 'pointer', fontSize: '12px' }}>&times;</button>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              <section className="cyber-card" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <h3 className="cyber-label" style={{ marginBottom: '1.5rem', color: 'var(--accent-pink)' }}>Algorithmic Parameters</h3>
                <div className="cyber-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                   <div className="cyber-form-group">
                     <label className="cyber-label">Venue Tier</label>
                     <select className="cyber-input" name="venueTier" value={formData.venueTier} onChange={handleChange}>
                       <option value={1}>Small</option>
                       <option value={2}>Medium</option>
                       <option value={3}>Stadium</option>
                     </select>
                   </div>
                   <div className="cyber-form-group">
                     <label className="cyber-label">Talent Class</label>
                     <select className="cyber-input" name="artistTier" value={formData.artistTier} onChange={handleChange}>
                       <option value={0}>N/A</option>
                       <option value={1}>Local</option>
                       <option value={2}>Regional</option>
                       <option value={3}>National</option>
                       <option value={4}>Global</option>
                       <option value={5}>Elite</option>
                     </select>
                   </div>
                   <div className="cyber-form-group">
                     <label className="cyber-label">Peak Cycle</label>
                     <select className="cyber-input" name="isHoliday" value={formData.isHoliday} onChange={handleChange}>
                       <option value={false}>Standard</option>
                       <option value={true}>Holiday/Peak</option>
                     </select>
                   </div>
                </div>
                
                <div className="cyber-form-group" style={{ marginTop: '1rem' }}>
                  <label className="cyber-label">Social Resonance (Popularity): {formData.eventPopularity}</label>
                  <input type="range" name="eventPopularity" value={formData.eventPopularity} onChange={handleChange} min="0" max="1" step="0.1" style={{ width: '100%', accentColor: 'var(--accent-cyan)' }} />
                </div>
              </section>
            </div>

            {/* Right Panel: Spatial Design */}
            <div className="flex-column" style={{ gap: '2rem' }}>
              <section className="cyber-card" style={{ padding: '1.5rem' }}>
                 <h3 className="cyber-label" style={{ marginBottom: '1.5rem', color: 'var(--warning)' }}>Spatial Architect</h3>
                 <VenueLayoutDesigner
                    layoutType={venueLayoutType}
                    setLayoutType={setVenueLayoutType}
                    stagePosition={stagePosition}
                    setStagePosition={setStagePosition}
                    categories={ticketCategories}
                    onCategoryColorChange={handleCategoryColorChange}
                    onCategoryBlockedSeatsChange={handleCategoryBlockedSeatsChange}
                    venueMetrics={venueMetrics}
                    setVenueMetrics={setVenueMetrics}
                    safetyScores={safetyScores}
                    setSafetyScores={setSafetyScores}
                    isSafetyMode={isSafetyMode}
                    setIsSafetyMode={setIsSafetyMode}
                    eventName={formData.name}
                    eventId={event?._id}
                    eventPopularity={formData.eventPopularity}
                    selectedCategory={ticketCategories.find(c=>c.name===activeCategory) || null}
                    onSelectCategory={(cat) => setActiveCategory(cat?.name || null)}
                    seatMap={seatMap}
                  />
              </section>

              <section className="cyber-card" style={{ padding: '1.5rem' }}>
                 <h3 className="cyber-label" style={{ marginBottom: '1.5rem' }}>Neural Matrix Preview</h3>
                 <div style={{ maxHeight: '400px', overflow: 'hidden', borderRadius: '12px' }}>
                   <SeatGridPreview 
                    categories={ticketCategories} 
                    seatMap={seatMap} 
                    onSeatMapChange={setSeatMap} 
                    safetyScores={safetyScores}
                    isSafetyMode={isSafetyMode}
                    activeCategory={activeCategory}
                    setActiveCategory={(name) => setActiveCategory(name)}
                  />
                 </div>
              </section>

              <div className="flex-center" style={{ gap: '1.5rem', marginTop: 'auto' }}>
                <button type="button" className="cyber-btn btn-outline" style={{ flex: 1 }} onClick={() => onClose(false)}>
                  ABORT
                </button>
                <button type="submit" className="cyber-btn btn-primary" style={{ flex: 2 }} disabled={loading}>
                  {loading ? 'PROCESSING...' : (event ? 'UPDATE PROTOCOLS' : 'INITIATE PRODUCTION')}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default AdminEventForm;
