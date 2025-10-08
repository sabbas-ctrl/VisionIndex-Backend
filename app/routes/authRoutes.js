import express from 'express';
import { 
  register, 
  login, 
  logout, 
  verifyAuth, 
  refreshToken,
  getUserSessions,
  revokeSession,
  revokeAllSessions,
  getUserProfile,
  changePassword
} from '../controllers/authController.js';
import { authMiddleware, refreshTokenMiddleware } from '../middlewares/authMiddleware.js';
import { activityLogger, authLogger } from '../middlewares/activityLogger.js';

const router = express.Router();

// Auth routes
router.post('/register', 
  activityLogger('user_register', { 
    targetId: (req) => req.body.email,
    details: (req) => ({ username: req.body.username, email: req.body.email })
  }),
  register
);
router.post('/login', 
  activityLogger('login', { 
    targetId: (req) => req.body.email,
    details: (req) => ({ email: req.body.email })
  }),
  login
);
router.post('/refresh', 
  refreshToken
);
router.post('/logout', 
  authMiddleware, 
  activityLogger('logout'),
  logout
);
router.get('/verify', 
  authMiddleware, 
  verifyAuth
);
router.get('/profile', 
  authMiddleware, 
  activityLogger('profile_view'),
  getUserProfile
);

// Change password route
router.post('/change-password', 
  authMiddleware,
  activityLogger('password_change', {
    details: (req) => ({ userId: req.user.userId })
  }),
  changePassword
);

// Password reset routes
import { forgotPassword, resetPassword, verifyEmail } from '../controllers/authController.js';
router.post('/forgot-password', 
  activityLogger('password_reset_request', { 
    targetId: (req) => req.body.email,
    details: (req) => ({ email: req.body.email })
  }),
  forgotPassword
);
router.post('/reset-password', 
  activityLogger('password_reset_complete', { 
    targetId: (req) => req.body.email,
    details: (req) => ({ email: req.body.email })
  }),
  resetPassword
);
router.post('/verify-email', 
  activityLogger('email_verification', { 
    targetId: (req) => req.body.email,
    details: (req) => ({ email: req.body.email })
  }),
  verifyEmail
);

// Session management routes
router.get('/sessions', 
  authMiddleware, 
  activityLogger('sessions_list'),
  getUserSessions
);
router.delete('/sessions/:tokenId', 
  authMiddleware, 
  activityLogger('session_revoke', { targetId: (req) => req.params.tokenId }),
  revokeSession
);
router.delete('/sessions', 
  authMiddleware, 
  activityLogger('sessions_revoke_all'),
  revokeAllSessions
);

export default router;