import { ROLES } from '../src/shared/constants/roles.js';
import { ROLE_PERMISSIONS, PERMISSIONS } from '../src/shared/constants/permissions.js';

describe('RBAC System Constants', () => {
  test('Admin should have all permissions', () => {
    const adminPermissions = ROLE_PERMISSIONS[ROLES.ADMIN];
    const allPermissionsCount = Object.values(PERMISSIONS).length;
    expect(adminPermissions.length).toBe(allPermissionsCount);
  });

  test('User should only have purchase_ticket permission', () => {
    const userPermissions = ROLE_PERMISSIONS[ROLES.USER];
    expect(userPermissions).toContain(PERMISSIONS.PURCHASE_TICKET);
    expect(userPermissions.length).toBe(1);
  });
});
