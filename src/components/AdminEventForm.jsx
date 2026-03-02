import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';
import './AdminEventForm.css';

function AdminEventForm({ event, onClose }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    venue: '',
    startDate: '',
    endDate: '',
    eventPopularity: 0.5,
    category: 'concert',
    image: 'public/events.png',
    status: 'upcoming',
    venueTier: 2,
    artistTier: 0,
    isHoliday: false
  });
  
  const [ticketCategories, setTicketCategories] = useState([
    { name: '', price: '', maxPrice: '', seats: '', availableSeats: undefined }
  ]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [imageSource, setImageSource] = useState('url'); // 'url' or 'upload'

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
      
      // Set ticket categories if they exist
      if (event.ticketCategories && event.ticketCategories.length > 0) {
        setTicketCategories(event.ticketCategories.map(cat => ({
          name: cat.name,
          price: cat.price,
          maxPrice: cat.maxPrice || cat.price * 2,
          seats: cat.seats,
          availableSeats: cat.availableSeats // Preserve available seats
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

    // Check immediately on mount/date changes
    updateStatusAutomatically();

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
    setTicketCategories([...ticketCategories, { name: '', price: '', maxPrice: '', seats: '', availableSeats: undefined }]);
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
        ticketCategories: validCategories.map(cat => ({
          name: cat.name,
          price: parseFloat(cat.price),
          maxPrice: cat.maxPrice ? parseFloat(cat.maxPrice) : parseFloat(cat.price) * 2,
          seats: parseInt(cat.seats),
          availableSeats: cat.availableSeats !== undefined ? parseInt(cat.availableSeats) : parseInt(cat.seats)
        }))
      };

      if (event) {
        // Update existing event
        await axios.put(`${API_URL}/admin/events/${event._id}`, eventData);
        alert('Event updated successfully!');
      } else {
        // Create new event
        await axios.post(`${API_URL}/admin/events`, eventData);
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
    <div className="admin-event-form-overlay bg-white dark:bg-gray-900 text-gray-900 dark:text-white min-h-screen">
      <div className="admin-event-form-container">
        <div className="form-header">
          <h2>{event ? 'Edit Event' : 'Create New Event'}</h2>
          <button className="close-btn" onClick={() => onClose(false)}>×</button>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="admin-event-form">
          <div className="form-group">
            <label htmlFor="name">Event Name *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description *</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="3"
              required
              disabled={loading}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="venue">Venue *</label>
              <input
                type="text"
                id="venue"
                name="venue"
                value={formData.venue}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="category">Category *</label>
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleChange}
                required
                disabled={loading}
              >
                <option value="concert">Concert</option>
                <option value="sports">Sports</option>
                <option value="theater">Theater</option>
                <option value="conference">Conference</option>
                <option value="festival">Festival</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="startDate">Start Date & Time *</label>
              <input
                type="datetime-local"
                id="startDate"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="endDate">End Date & Time</label>
              <input
                type="datetime-local"
                id="endDate"
                name="endDate"
                value={formData.endDate}
                onChange={handleChange}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="status">Status</label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                disabled={loading}
              >
                <option value="upcoming">Upcoming</option>
                <option value="ongoing">Ongoing</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
          
          <div className="form-section">
            <div className="section-header">
              <h3>Ticket Categories *</h3>
              <button 
                type="button" 
                className="add-category-btn" 
                onClick={addTicketCategory}
                disabled={loading}
              >
                + Add Category
              </button>
            </div>
            
            {ticketCategories.map((category, index) => (
              <div key={index} className="ticket-category-row">
                <div className="category-fields">
                  <div className="form-group category-field">
                    <label>Type</label>
                    <input
                      type="text"
                      list="category-options"
                      value={category.name}
                      onChange={(e) => handleCategoryChange(index, 'name', e.target.value)}
                      placeholder="e.g., VIP, Standard"
                      disabled={loading}
                      required
                    />
                    <datalist id="category-options">
                      <option value="standard">Standard</option>
                      <option value="vip">VIP</option>
                      <option value="premium">Premium</option>
                      <option value="balcony">Balcony</option>
                      <option value="economy">Economy</option>
                    </datalist>
                  </div>
                  
                  <div className="form-group category-field">
                    <label>Seats</label>
                    <input
                      type="number"
                      value={category.seats}
                      onChange={(e) => handleCategoryChange(index, 'seats', e.target.value)}
                      min="1"
                      placeholder="e.g., 100"
                      disabled={loading}
                      required
                    />
                  </div>
                  
                  <div className="form-group category-field">
                    <label>Price (₹)</label>
                    <input
                      type="number"
                      value={category.price}
                      onChange={(e) => handleCategoryChange(index, 'price', e.target.value)}
                      min="0"
                      step="0.01"
                      placeholder="e.g., 50.00"
                      disabled={loading}
                      required
                    />
                  </div>
                  
                  <div className="form-group category-field">
                    <label>Max Price (₹)</label>
                    <input
                      type="number"
                      value={category.maxPrice}
                      onChange={(e) => handleCategoryChange(index, 'maxPrice', e.target.value)}
                      min={category.price || 0}
                      step="0.01"
                      placeholder={category.price ? `Default: ${(parseFloat(category.price) * 2).toFixed(2)}` : 'e.g., 100.00'}
                      disabled={loading}
                      title="Maximum price for dynamic pricing (leave empty for 2x base)"
                    />
                  </div>
                </div>
                
                {ticketCategories.length > 1 && (
                  <button
                    type="button"
                    className="remove-category-btn"
                    onClick={() => removeTicketCategory(index)}
                    disabled={loading}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="form-group">
            <label htmlFor="eventPopularity">
              Event Popularity: {formData.eventPopularity}
            </label>
            <input
              type="range"
              id="eventPopularity"
              name="eventPopularity"
              value={formData.eventPopularity}
              onChange={handleChange}
              min="0"
              max="1"
              step="0.1"
              disabled={loading}
            />
            <small>0 = Low popularity, 1 = High popularity</small>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="venueTier">Venue Tier</label>
              <select
                id="venueTier"
                name="venueTier"
                value={formData.venueTier}
                onChange={handleChange}
                disabled={loading}
              >
                <option value={1}>Small Venue</option>
                <option value={2}>Medium Venue</option>
                <option value={3}>Large / Stadium</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="artistTier">Artist / Performer Tier</label>
              <select
                id="artistTier"
                name="artistTier"
                value={formData.artistTier}
                onChange={handleChange}
                disabled={loading}
              >
                <option value={0}>No Artist / N/A</option>
                <option value={1}>Local</option>
                <option value={2}>Regional</option>
                <option value={3}>National</option>
                <option value={4}>International</option>
                <option value={5}>Superstar</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="isHoliday">Holiday Event?</label>
              <select
                id="isHoliday"
                name="isHoliday"
                value={formData.isHoliday}
                onChange={handleChange}
                disabled={loading}
              >
                <option value={false}>No</option>
                <option value={true}>Yes</option>
              </select>
              <small>Is this event on or near a holiday?</small>
            </div>
          </div>

          <div className="form-group">
            <label>Event Image</label>
            <div className="image-source-toggle">
              <button
                type="button"
                className={`toggle-btn ${imageSource === 'url' ? 'active' : ''}`}
                onClick={() => setImageSource('url')}
                disabled={loading}
              >
                URL
              </button>
              <button
                type="button"
                className={`toggle-btn ${imageSource === 'upload' ? 'active' : ''}`}
                onClick={() => setImageSource('upload')}
                disabled={loading}
              >
                Upload
              </button>
            </div>
            
            {imageSource === 'url' ? (
              <input
                type="url"
                id="image"
                name="image"
                value={formData.image}
                onChange={handleChange}
                placeholder="https://example.com/image.jpg"
                disabled={loading}
              />
            ) : (
              <div className="image-upload-section">
                <input
                  type="file"
                  id="imageFile"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      if (file.size > 5 * 1024 * 1024) {
                        setError('Image size must be less than 5MB');
                        return;
                      }
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setImagePreview(reader.result);
                        setFormData(prev => ({ ...prev, image: reader.result }));
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  disabled={loading}
                />
                <small>Max size: 5MB. Supported: JPG, PNG, GIF</small>
              </div>
            )}
            
            {(formData.image || imagePreview) && (
              <div className="image-preview">
                <img 
                  src={imagePreview || formData.image} 
                  alt="Event preview" 
                  onError={(e) => e.target.src = 'public/favicon.ico'}
                />
              </div>
            )}
          </div>

          <div className="form-actions">
            <button 
              type="button" 
              className="cancel-btn" 
              onClick={() => onClose(false)}
              disabled={loading}
            >
              Cancel
            </button>
            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Saving...' : (event ? 'Update Event' : 'Create Event')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AdminEventForm;
