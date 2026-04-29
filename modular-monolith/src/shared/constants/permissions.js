import { ROLES } from './roles.js';

/**
 * 🔑 Granular Permissions
 * 
 * Allows for fine-grained access control instead of just checking roles.
 */
export const PERMISSIONS = {
  // User Management
  MANAGE_USERS: 'manage_users',
  VIEW_USERS: 'view_users',
  
  // Event/Catalog Management
  CREATE_EVENT: 'create_event',
  EDIT_EVENT: 'edit_event',
  DELETE_EVENT: 'delete_event',
  
  // Ticket Management
  MANAGE_TICKETS: 'manage_tickets',
  VIEW_SALES: 'view_sales',
  
  // System/Admin
  VIEW_ANALYTICS: 'view_analytics',
  MANAGE_SYSTEM: 'manage_system',
  
  // General
  PURCHASE_TICKET: 'purchase_ticket'
};

/**
 * 🗺️ Role to Permission Mapping
 */
export const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: Object.values(PERMISSIONS),
  
  [ROLES.ORGANIZER]: [
    PERMISSIONS.CREATE_EVENT,
    PERMISSIONS.EDIT_EVENT,
    PERMISSIONS.DELETE_EVENT,
    PERMISSIONS.MANAGE_TICKETS,
    PERMISSIONS.VIEW_SALES,
    PERMISSIONS.PURCHASE_TICKET
  ],
  
  [ROLES.STAFF]: [
    PERMISSIONS.VIEW_USERS,
    PERMISSIONS.VIEW_SALES,
    PERMISSIONS.PURCHASE_TICKET
  ],
  
  [ROLES.USER]: [
    PERMISSIONS.PURCHASE_TICKET
  ]
};

export default PERMISSIONS;
