import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../services/authService';
import { useLocalizedHref } from '../i18n/useLocalizedNavigate';
import { useSEO } from '../utils/useSEO';

/**
 * /reset-password?token=XYZ — lands the user here from the password-reset
 * email. Two password fields with confirmation; on success we redirect to
 * /login with a one-shot banner asking the user to sign in.
 *
 * The token is opaque on the client — the backend hashes and looks it up
 * server-side. We don't expose any timing-side-channel here: invalid /
 * expired / used tokens all surface as the same generic 400 error from
 * the backend.
 */
export const ResetPasswordPage: React.FC = () => {
  const localize = useLocalizedHref();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  useSEO({
    title: 'Reset password — Velxio',
    description: 'Set a new password for your Velxio account.',
    url: 'https://velxio.dev/reset-password',
    noindex: true,
  });

  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const hasToken = token.length >= 16;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      await resetPassword(token, newPassword);
      navigate(localize('/login') + '?reset=ok');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(
        detail ||
          "We couldn't reset your password. The link may have expired or already been used.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (!hasToken) {
    return (
      <div className="ap-page">
        <div className="ap-card">
          <h1 className="ap-card-title">Invalid reset link</h1>
          <p className="ap-card-sub">
            This link is missing the reset token or is malformed. Request a
            new one and try again.
          </p>
          <p className="ap-footer">
            <Link to={localize('/forgot-password')} className="ap-link">
              Request a new reset link
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="ap-page">
      <div className="ap-card">
        <h1 className="ap-card-title">Choose a new password</h1>
        <p className="ap-card-sub">
          Pick a password at least 8 characters long. You'll be signed out of
          any other sessions and asked to sign in again with the new one.
        </p>

        {error && <div className="ap-error">{error}</div>}

        <form onSubmit={handleSubmit} className="ap-form">
          <div className="ap-field">
            <label className="ap-label">New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="ap-input"
              autoFocus
              autoComplete="new-password"
              minLength={8}
            />
          </div>
          <div className="ap-field">
            <label className="ap-label">Confirm new password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="ap-input"
              autoComplete="new-password"
              minLength={8}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !newPassword || !confirm}
            className="ap-btn-primary"
          >
            {loading ? 'Resetting…' : 'Reset password'}
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
