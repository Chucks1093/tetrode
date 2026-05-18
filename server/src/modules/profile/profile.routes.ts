import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware';
import {
   httpProfileGoogleCallback,
   httpProfileForgotPassword,
   httpProfileGoogleStart,
   httpProfileLogin,
   httpProfileLogout,
   httpProfileMe,
   httpProfileResendVerification,
   httpProfileRegister,
   httpProfileResetPassword,
   httpProfileUpdate,
   httpProfileUpdateWallet,
   httpProfileVerifyEmail,
} from './profile.controllers';

const profileRouter = Router();

profileRouter.post('/register', httpProfileRegister);
profileRouter.post('/login', httpProfileLogin);
profileRouter.post('/password/forgot', httpProfileForgotPassword);
profileRouter.post('/password/reset', httpProfileResetPassword);
profileRouter.post('/logout', requireAuth, httpProfileLogout);
profileRouter.post('/verify-email', httpProfileVerifyEmail);
profileRouter.post('/resend-verification', httpProfileResendVerification);
profileRouter.patch('/', requireAuth, httpProfileUpdate);
profileRouter.patch('/wallet', requireAuth, httpProfileUpdateWallet);
profileRouter.get('/me', requireAuth, httpProfileMe);
profileRouter.get('/google', httpProfileGoogleStart);
profileRouter.get('/google/callback', httpProfileGoogleCallback);

export default profileRouter;
