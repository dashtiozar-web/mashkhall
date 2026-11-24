/**
 * Clear messages for sign-in problems, instead of Firebase's raw codes such
 * as "Firebase: Error (auth/unauthorized-domain)".
 */

/** Facebook, Messenger, Instagram and TikTok open links in their own browsers, where Google sign-in is blocked. */
export const inAppBrowser = () => {
  if (typeof navigator === 'undefined') return false;
  return /FBAN|FBAV|FB_IAB|Messenger|Instagram|Line\/|TikTok|musical_ly|Bytedance|Snapchat|; wv\)/i.test(navigator.userAgent || '');
};

export const authErrorMessage = (err: unknown, via: 'google' | 'email' = 'email'): string => {
  const code = (err as { code?: string })?.code || '';
  const host = typeof window !== 'undefined' ? window.location.hostname : 'this website';
  switch (code) {
    case 'auth/unauthorized-domain':
      return `Google sign-in has not been switched on for this web address (${host}) yet. We have been told and are fixing it. Please sign in with your email address and password for now.`;
    case 'auth/operation-not-allowed':
      return via === 'google'
        ? 'Google sign-in is not switched on for this website yet. Please sign in with your email address and password.'
        : 'Signing in with email and password is not switched on for this website yet. Please contact us.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google sign-in window. Allow pop-ups for this website and try again, or sign in with your email address and password.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'auth/user-cancelled':
      return 'The Google sign-in window was closed before you finished. Please try again.';
    case 'auth/operation-not-supported-in-this-environment':
    case 'auth/web-storage-unsupported':
      return 'This browser cannot complete Google sign-in. Open the website in Chrome, Safari, Firefox or Edge, or sign in with your email address and password.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email address. Sign in with your email address and password instead.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return 'The email address or password is not correct.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/user-disabled':
      return 'This account has been switched off. Please contact us.';
    case 'auth/email-already-in-use':
      return 'An account with this email address already exists. Please sign in instead.';
    case 'auth/weak-password':
      return 'Please choose a stronger password (at least 6 characters).';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a few minutes and try again, or reset your password.';
    case 'auth/network-request-failed':
    case 'auth/timeout':
      return 'No connection to the sign-in service. Check your internet connection and try again.';
    case 'auth/internal-error':
      return 'The sign-in service had a problem. Please try again in a moment.';
    case 'auth/missing-email':
      return 'Please enter your email address.';
    default:
      return via === 'google' ? 'Google sign-in did not work. Please try again, or sign in with your email address and password.' : 'Sign-in did not work. Please try again.';
  }
};
