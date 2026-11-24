import React, { useState } from 'react';
import { authErrorMessage, inAppBrowser } from '../lib/authErrors';
import { reportSecurityEvent } from '../lib/visits';
import { X, Mail, Lock, User, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Logo } from './ui';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'signin' | 'signup' | 'reset';
  onNavigateToApply?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ 
  isOpen, 
  onClose, 
  defaultMode = 'signin',
  onNavigateToApply 
}) => {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, sendPasswordReset } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>(defaultMode);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [agreePolicy, setAgreePolicy] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password);
        onClose();
      } else if (mode === 'signup') {
        if (!displayName.trim()) {
          setError('Please enter your full or public name.');
          setSubmitting(false);
          return;
        }
        if (password.length < 6) {
          setError('Password must be at least 6 characters long.');
          setSubmitting(false);
          return;
        }
        if (password !== confirmPassword) {
          setError('Passwords do not match.');
          setSubmitting(false);
          return;
        }
        if (!agreePolicy) {
          setError('Please accept our code of conduct and privacy notice.');
          setSubmitting(false);
          return;
        }
        await signUpWithEmail(email, password, displayName);
        setSuccess('Account created successfully! Please check your inbox to verify your email.');
        setTimeout(() => {
          onClose();
          if (onNavigateToApply) onNavigateToApply();
        }, 1500);
      } else if (mode === 'reset') {
        await sendPasswordReset(email);
        setSuccess('Password reset link sent to your email address.');
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(authErrorMessage(err, 'email'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await signInWithGoogle();
      onClose();
    } catch (err: any) {
      console.error('Google Sign In error:', err);
      if (err?.code === 'auth/unauthorized-domain') reportSecurityEvent('auth_config');
      setError(authErrorMessage(err, 'google'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/55">
      <div className="bg-surface rounded-xl shadow-sm max-w-md w-full overflow-hidden border border-line">
        
        {/* Header */}
        <div className="bg-surface text-ink p-6 relative">
          <button 
            onClick={onClose}
            className="absolute top-4 end-4 text-muted hover:text-ink p-1 rounded-lg"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-3 mb-2">
            <Logo size={40} />
            <div>
              <h2 className="font-serif font-semibold text-[1.375rem] text-ink">
                {mode === 'signin' && 'Sign in'}
                {mode === 'signup' && 'Create an account'}
                {mode === 'reset' && 'Reset your password'}
              </h2>
              <p className="text-[0.8438rem] text-ink-soft">
                Mashkhally Zhyanawa member account
              </p>
            </div>
          </div>
        </div>

        {/* Content body */}
        <div className="p-6">
          {error && (
            <div role="alert" className="mb-4 p-3 rounded-lg bg-crimson/5 border border-crimson/30 text-crimson text-[0.875rem] flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[0.8438rem] flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-[0.8438rem] font-semibold text-ink-soft mb-1">
                  Full or Public Display Name <span className="text-crimson">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-muted absolute start-3 top-3" />
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Dilan Aziz"
                    className="w-full ps-9 pe-3 py-2 text-sm rounded-lg border border-line focus:outline-hidden focus:ring-2 focus:ring-navy/30 focus:border-navy text-ink"
                  />
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[0.8438rem] font-semibold text-ink-soft">
                  Email address <span className="text-crimson">*</span>
                </label>
              </div>
              <div className="relative">
                <Mail className="w-4 h-4 text-muted absolute start-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full ps-9 pe-3 py-2 text-sm rounded-lg border border-line focus:outline-hidden focus:ring-2 focus:ring-navy/30 focus:border-navy text-ink"
                />
              </div>
            </div>

            {mode !== 'reset' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[0.8438rem] font-semibold text-ink-soft">
                    Password <span className="text-crimson">*</span>
                  </label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => setMode('reset')}
                      className="text-[0.8438rem] text-navy hover:text-navy-deep font-medium"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-muted absolute start-3 top-3" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full ps-9 pe-3 py-2 text-sm rounded-lg border border-line focus:outline-hidden focus:ring-2 focus:ring-navy/30 focus:border-navy text-ink"
                  />
                </div>
              </div>
            )}

            {mode === 'signup' && (
              <div>
                <label className="block text-[0.8438rem] font-semibold text-ink-soft mb-1">
                  Confirm Password <span className="text-crimson">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-muted absolute start-3 top-3" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full ps-9 pe-3 py-2 text-sm rounded-lg border border-line focus:outline-hidden focus:ring-2 focus:ring-navy/30 focus:border-navy text-ink"
                  />
                </div>

                <div className="mt-3 flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="policyAgreement"
                    checked={agreePolicy}
                    onChange={(e) => setAgreePolicy(e.target.checked)}
                    className="mt-0.5 rounded border-line text-navy focus:ring-navy/30"
                  />
                  <label htmlFor="policyAgreement" className="text-[0.8438rem] text-ink-soft leading-snug">
                    I agree to Mashkhally Zhyanawa's peaceful principles, universal human rights code of conduct, and privacy policy.
                  </label>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 bg-navy hover:bg-navy-deep text-white font-semibold text-sm rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <span>Processing...</span>
              ) : (
                <>
                  <span>
                    {mode === 'signin' && 'Sign in'}
                    {mode === 'signup' && 'Create account'}
                    {mode === 'reset' && 'Send reset link'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Social login divider */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-line" />
            </div>
            <div className="relative flex justify-center text-[0.8438rem]">
              <span className="px-2 bg-surface text-muted">
                Or continue with
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={submitting}
            className="w-full py-2 px-4 border border-line rounded-lg text-sm font-medium text-ink-soft hover:bg-stone transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>
          {inAppBrowser() && (
            <p className="mt-2 text-[0.8125rem] text-muted">You seem to be using the browser inside an app (such as Facebook or Messenger), where Google sign-in may not work. Open this page in Chrome or Safari, or use your email address and password.</p>
          )}

          {/* Mode switch */}
          <div className="mt-6 text-center text-[0.8438rem] text-ink-soft">
            {mode === 'signin' && (
              <p>
                Don't have an account yet?{' '}
                <button
                  onClick={() => {
                    setMode('signup');
                    setError(null);
                  }}
                  className="font-semibold text-navy hover:text-navy-deep underline ms-1"
                >
                  Create one
                </button>
              </p>
            )}

            {mode === 'signup' && (
              <p>
                Already have an account?{' '}
                <button
                  onClick={() => {
                    setMode('signin');
                    setError(null);
                  }}
                  className="font-semibold text-navy hover:text-navy-deep underline ms-1"
                >
                  Sign in
                </button>
              </p>
            )}

            {mode === 'reset' && (
              <p>
                Remember your password?{' '}
                <button
                  onClick={() => {
                    setMode('signin');
                    setError(null);
                  }}
                  className="font-semibold text-navy hover:text-navy-deep underline ms-1"
                >
                  Back to Sign In
                </button>
              </p>
            )}
          </div>

          <div className="mt-4 p-2.5 rounded-lg bg-stone border border-line text-[0.8125rem] text-muted leading-normal">
            An account lets you apply for membership and follow your application. Creating an account, or signing in with Google, does not make you a member until the committee approves your application. You do not need an account to publish with us.
          </div>
        </div>
      </div>
    </div>
  );
};
