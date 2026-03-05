/**
 * Notification service for alerting admins about critical system events
 */

const axios = require('axios');

// Store for tracking recent notifications to avoid spam
const notificationThrottle = new Map();
const THROTTLE_PERIOD = 5 * 60 * 1000; // 5 minutes

const notificationService = {
  /**
   * Send ML service failure notification to admins
   * @param {Error} error - The error that occurred
   * @param {Object} context - Additional context about the failure
   */
  async notifyMLFailure(error, context = {}) {
    const notificationKey = 'ml_failure';
    
    // Check throttle to avoid spam
    const lastNotified = notificationThrottle.get(notificationKey);
    if (lastNotified && Date.now() - lastNotified < THROTTLE_PERIOD) {
      console.log('ML failure notification throttled');
      return;
    }
    
    notificationThrottle.set(notificationKey, Date.now());
    
    const notification = {
      type: 'ML_SERVICE_FAILURE',
      severity: 'warning',
      message: 'ML prediction service is unavailable',
      error: error.message,
      context: {
        ...context,
        timestamp: new Date().toISOString(),
        fallbackUsed: true
      }
    };
    
    // Log the notification
    console.warn('🚨 ML SERVICE ALERT:', JSON.stringify(notification, null, 2));
    
    // If webhook URL is configured, send notification
    const webhookUrl = process.env.ADMIN_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        await axios.post(webhookUrl, notification, {
          timeout: 5000,
          headers: { 'Content-Type': 'application/json' }
        });
        console.log('✅ Admin notification sent successfully');
      } catch (webhookError) {
        console.error('Failed to send webhook notification:', webhookError.message);
      }
    }
    
    // Store notification in database for admin dashboard (if MLModel tracking exists)
    try {
      const PredictionLog = require('../models/PredictionLog');
      await PredictionLog.create({
        eventId: context.eventId,
        inputFeatures: context.features || {},
        predictedPrice: null,
        success: false,
        errorMessage: error.message,
        fallbackUsed: true,
        timestamp: new Date()
      });
    } catch (dbError) {
      // Non-critical, just log
      console.error('Failed to log ML failure to database:', dbError.message);
    }
  },
  
  /**
   * Send critical system error notification
   * @param {string} component - The component that failed
   * @param {Error} error - The error
   */
  async notifySystemError(component, error) {
    const notificationKey = `system_error_${component}`;
    
    const lastNotified = notificationThrottle.get(notificationKey);
    if (lastNotified && Date.now() - lastNotified < THROTTLE_PERIOD) {
      return;
    }
    
    notificationThrottle.set(notificationKey, Date.now());
    
    console.error(`🚨 SYSTEM ERROR [${component}]:`, error.message);
    
    const webhookUrl = process.env.ADMIN_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        await axios.post(webhookUrl, {
          type: 'SYSTEM_ERROR',
          severity: 'error',
          component,
          message: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
          timestamp: new Date().toISOString()
        }, { timeout: 5000 });
      } catch (webhookError) {
        console.error('Failed to send system error notification:', webhookError.message);
      }
    }
  },
  
  /**
   * Check and report service health issues
   */
  async checkMLServiceHealth() {
    const mlApiUrl = process.env.ML_API_URL || 'http://localhost:5000';
    
    try {
      const response = await axios.get(`${mlApiUrl}/health`, { timeout: 5000 });
      return {
        healthy: true,
        status: response.data
      };
    } catch (error) {
      await this.notifyMLFailure(error, { healthCheck: true });
      return {
        healthy: false,
        error: error.message
      };
    }
  }
};

module.exports = notificationService;
