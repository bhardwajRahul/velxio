import { useState } from 'react';
import { Link } from 'react-router-dom';
import { requestPasswordReset } from '../services/authService';
import { useLocalizedHref } from '../i18n/useLocalizedNavigate';
import { useSEO } from '../utils/useSEO';

/**
 * /forgot-password — single email field. The backend always returns the
 * same generic message regardless of whether the address is on file
 * (anti-enumeration), so we show the same "check your inbox" UI either
 * way. Only network errors flip us into the error state.
 */
export const ForgotPasswordPage: React.FC = () => {
  const localize = useLocalizedHref();
  useSEO({
    title: 'Forgot password — Velxio',
    description: 'Reset the password on your Velxio account.',
    url: 'https://velxio.dev/forgot-password',
    noindex: true,
  });

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await requestPasswordReset(email);
      setSubmitted(true);
    } catch (err) {
      // Network or server error — surface a generic message. The endpoint
      // itself never returns 4xx for unknown emails (anti-enumeration).
      setError("Couldn't reach the server. Please try again in a moment.");
      console.error('[forgot-password]', err);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="ap-page">
        <div className="ap-card">
          <h1 className="ap-card-title">Check your inbox</h1>
          <p className="ap-card-sub">
            If an account exists for <strong>{email}</strong>, we just sent a
            reset link. The link expires in 60 minutes and can only be used
            once.
          </p>
          <p className="ap-footer">
            <Link to={localize('/login')} className="ap-link">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="ap-page">
      <div className="ap-card">
        <h1 className="ap-card-title">Forgot your password?</h1>
        <p className="ap-card-sub">
          Enter the email tied to your Velxio account and we'll send you a
          link to choose a new password.
        </p>

        {error && <div className="ap-error">{error}</div>}

        <form onSubmit={handleSubmit} className="ap-form">
          <div className="ap-field">
            <label className="ap-label">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="ap-input"
              autoFocus
              autoComplete="email"
            />
          </div>
          <button type="submit" disabled={loading || !email} className="ap-btn-primary">
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>

        <p className="ap-footer">
          <Link to={localize('/login')} className="ap-link">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
};
