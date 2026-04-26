import { EventEmitter } from 'events';

/**
 * 🚌 Internal Event Bus
 * 
 * Provides an in-memory Pub/Sub mechanism for inter-module communication.
 * Allows decoupling of modules by using events instead of direct service calls 
 * for secondary actions (emails, notifications, analytics).
 */

class InternalBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
    this.pendingEvents = 0;
    this.highTrafficThreshold = 100; // Trigger backpressure at 100 pending events
  }

  /**
   * Publish an event to the bus with priority
   * @param {string} eventName 
   * @param {any} payload 
   * @param {boolean} isCritical - If true, ignores backpressure (e.g. ticket sales)
   */
  publish(eventName, payload, isCritical = false) {
    this.pendingEvents++;

    // OS Concept: Backpressure & Prioritization
    // During high traffic, skip non-critical events (like background analytics)
    // to keep the main thread responsive for sales.
    if (this.pendingEvents > this.highTrafficThreshold && !isCritical) {
      console.warn(`⚠️ [Bus] Backpressure: Throttling non-critical event ${eventName}`);
      this.pendingEvents--;
      return;
    }

    if (this.pendingEvents > this.highTrafficThreshold) {
      console.log(`📡 [Bus] High Traffic: Prioritizing critical event ${eventName}`);
    } else {
      console.log(`📡 [Bus] Publishing: ${eventName}`);
    }

    // Use setImmediate to allow the event loop to breathe
    setImmediate(() => {
      try {
        this.emit(eventName, payload);
      } finally {
        this.pendingEvents = Math.max(0, this.pendingEvents - 1);
      }
    });
  }


  /**
   * Subscribe to an event
   * @param {string} eventName 
   * @param {function} callback 
   */
  subscribe(eventName, callback) {
    this.on(eventName, callback);
  }

  /**
   * Unsubscribe from an event
   * @param {string} eventName 
   * @param {function} callback 
   */
  unsubscribe(eventName, callback) {
    this.removeListener(eventName, callback);
  }
}

const bus = new InternalBus();
export default bus;
