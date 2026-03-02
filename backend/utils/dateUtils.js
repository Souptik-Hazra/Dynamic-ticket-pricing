/**
 * Consolidated Date Utilities
 * Centralized location for all date-related helper functions
 */

/**
 * Get season number based on date
 * @param {Date|string} date - The date to check
 * @returns {number} 1=Winter, 2=Spring, 3=Summer, 4=Fall
 */
const getSeason = (date) => {
  const month = new Date(date).getMonth() + 1;
  if (month >= 3 && month <= 5) return 2; // Spring
  if (month >= 6 && month <= 8) return 3; // Summer
  if (month >= 9 && month <= 11) return 4; // Fall
  return 1; // Winter
};

/**
 * Get day of week as number
 * @param {Date|string} date - The date to check
 * @returns {number} 1-7 where 1=Monday, 7=Sunday
 */
const getDayOfWeek = (date) => {
  return new Date(date).getDay() || 7; // Sunday = 7
};

/**
 * Get date X days ago
 * @param {number} days - Number of days to subtract
 * @returns {Date} Date object for the past date
 */
const getDaysAgo = (days) => {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
};

/**
 * Format date to ISO string (YYYY-MM-DD)
 * @param {Date} date - The date to format
 * @returns {string} Formatted date string
 */
const formatDateString = (date) => {
  return new Date(date).toISOString().split('T')[0];
};

/**
 * Get hour of day (0-23)
 * @param {Date|string} date - The date to check
 * @returns {number} Hour (0-23)
 */
const getHourOfDay = (date) => {
  return new Date(date).getHours();
};

/**
 * Check if date is in the past
 * @param {Date|string} date - The date to check
 * @returns {boolean} True if date is in the past
 */
const isPast = (date) => {
  return new Date(date) < new Date();
};

/**
 * Check if date is in the future
 * @param {Date|string} date - The date to check
 * @returns {boolean} True if date is in the future
 */
const isFuture = (date) => {
  return new Date(date) > new Date();
};

/**
 * Check if two dates are on the same day
 * @param {Date|string} date1 - First date
 * @param {Date|string} date2 - Second date
 * @returns {boolean} True if dates are the same day
 */
const isSameDay = (date1, date2) => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return d1.toDateString() === d2.toDateString();
};

module.exports = {
  getSeason,
  getDayOfWeek,
  getDaysAgo,
  formatDateString,
  getHourOfDay,
  isPast,
  isFuture,
  isSameDay
};
