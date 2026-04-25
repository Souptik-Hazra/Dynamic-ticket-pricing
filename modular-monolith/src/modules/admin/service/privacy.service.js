import User from '../../users/model/user.model.js';
import Ledger from '../../payments/model/ledger.model.js';
import { logEvent } from '../../../shared/utils/logger.js';

/**
 * ⚖️ GDPR Compliance Service (Phase 11)
 * 
 * Implements "Right to be Forgotten" and data masking for privacy.
 */

export const purgeUserData = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) throw new Error('USER_NOT_FOUND');

    // 1. Mask PII in financial records (We cannot delete financial logs for tax reasons)
    await Ledger.updateMany(
      { userId },
      { $set: { description: 'DATA_PURGED_GDPR', metadata: {} } }
    );

    // 2. Delete the user record
    await User.findByIdAndDelete(userId);

    logEvent('Privacy-Service', 'USER_PURGED', `User ${userId} data purged under GDPR Right to be Forgotten.`);
    return true;
  } catch (err) {
    logEvent('Privacy-Service', 'PURGE_FAILED', err.message, { userId }, 'ERROR');
    throw err;
  }
};

export default { purgeUserData };
