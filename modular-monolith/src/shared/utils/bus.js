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
  }

  /**
   * Publish an event to the bus
   * @param {string} eventName 
   * @param {any} payload 
   */
  publish(eventName, payload) {
    console.log(`📡 [Bus] Publishing: ${eventName}`);
    this.emit(eventName, payload);
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
