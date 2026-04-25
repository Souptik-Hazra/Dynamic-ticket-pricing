import { EventEmitter } from 'events';

/**
 * InternalBus
 * 
 * The communication backbone of the Modular Monolith.
 * Enables modules to interact without direct imports, reducing coupling.
 */
class InternalBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
  }

  /**
   * Publish an event to the system
   * @param {string} event - The event name (e.g., 'payment.success')
   * @param {object} payload - The data associated with the event
   */
  publish(event, payload) {
    console.log(`[Bus] 📡 Event Published: ${event}`);
    this.emit(event, payload);
  }

  /**
   * Subscribe to a system event
   * @param {string} event - The event name
   * @param {function} callback - The handler function
   */
  subscribe(event, callback) {
    this.on(event, callback);
  }
}

const bus = new InternalBus();
export default bus;
