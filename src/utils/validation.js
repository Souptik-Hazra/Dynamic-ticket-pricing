// Frontend validation utilities for ticket purchase and forms

/**
 * Validate email format
 * @param {string} email 
 * @returns {{ valid: boolean, error?: string }}
 */
export const validateEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' };
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return { valid: false, error: 'Please enter a valid email address' };
  }
  
  return { valid: true };
};

/**
 * Validate password strength
 * @param {string} password 
 * @returns {{ valid: boolean, error?: string }}
 */
export const validatePassword = (password) => {
  if (!password) {
    return { valid: false, error: 'Password is required' };
  }
  
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }
  
  if (!/\d/.test(password)) {
    return { valid: false, error: 'Password must contain at least one number' };
  }
  
  if (!/[a-zA-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one letter' };
  }
  
  return { valid: true };
};

/**
 * Validate ticket quantity
 * @param {number|string} quantity
 * @param {number} maxAvailable
 * @returns {{ valid: boolean, error?: string, value?: number }}
 */
export const validateQuantity = (quantity, maxAvailable = 15) => {
  const parsed = parseInt(quantity, 10);
  
  if (isNaN(parsed) || parsed < 1) {
    return { valid: false, error: 'Quantity must be at least 1' };
  }
  
  if (parsed > 15) {
    return { valid: false, error: 'Maximum 15 tickets allowed per purchase' };
  }
  
  if (maxAvailable !== undefined && parsed > maxAvailable) {
    return { valid: false, error: `Only ${maxAvailable} tickets available` };
  }
  
  return { valid: true, value: parsed };
};

/**
 * Validate customer name
 * @param {string} name 
 * @returns {{ valid: boolean, error?: string }}
 */
export const validateName = (name) => {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Name is required' };
  }
  
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    return { valid: false, error: 'Name must be at least 2 characters' };
  }
  
  if (trimmed.length > 100) {
    return { valid: false, error: 'Name must be less than 100 characters' };
  }
  
  return { valid: true };
};

/**
 * Validate event form data
 * @param {object} eventData 
 * @returns {{ valid: boolean, errors: object }}
 */
export const validateEventForm = (eventData) => {
  const errors = {};
  
  if (!eventData.name?.trim()) {
    errors.name = 'Event name is required';
  }
  
  if (!eventData.description?.trim()) {
    errors.description = 'Event description is required';
  }
  
  if (!eventData.venue?.trim()) {
    errors.venue = 'Venue is required';
  }
  
  if (!eventData.startDate) {
    errors.startDate = 'Start date is required';
  } else {
    const startDate = new Date(eventData.startDate);
    if (startDate <= new Date()) {
      errors.startDate = 'Event date must be in the future';
    }
  }
  
  if (!eventData.ticketCategories || eventData.ticketCategories.length === 0) {
    errors.ticketCategories = 'At least one ticket category is required';
  } else {
    eventData.ticketCategories.forEach((cat, index) => {
      if (!cat.price || cat.price <= 0) {
        errors[`category_${index}_price`] = 'Price must be greater than 0';
      }
      if (!cat.seats || cat.seats <= 0) {
        errors[`category_${index}_seats`] = 'Seats must be greater than 0';
      }
    });
  }
  
  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
};

/**
 * Validate ticket purchase form
 * @param {object} purchaseData 
 * @param {number} maxAvailable 
 * @returns {{ valid: boolean, errors: object }}
 */
export const validatePurchaseForm = (purchaseData, maxAvailable) => {
  const errors = {};
  
  const nameResult = validateName(purchaseData.customerName);
  if (!nameResult.valid) {
    errors.customerName = nameResult.error;
  }
  
  const emailResult = validateEmail(purchaseData.customerEmail);
  if (!emailResult.valid) {
    errors.customerEmail = emailResult.error;
  }
  
  const quantityResult = validateQuantity(purchaseData.quantity, maxAvailable);
  if (!quantityResult.valid) {
    errors.quantity = quantityResult.error;
  }
  
  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
};

export default {
  validateEmail,
  validatePassword,
  validateQuantity,
  validateName,
  validateEventForm,
  validatePurchaseForm
};
