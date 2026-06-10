import React, { useState } from 'react';
import { ShieldAlert, KeyRound, CheckCircle2 } from 'lucide-react';
import { API_CONFIG } from '../config';
import { createAuthHeaders } from '../services/api';
import { useAuth } from './AuthProvider';

export function CeoSecuritySettings() {
  const { logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/auth/ceo-password`, {
        method: 'POST',
        headers: createAuthHeaders(true),
        body: JSON.stringify({ currentPassword, newPassword })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to change password');
      }

      setSuccess(true);
      // Wait a moment so user can read success message, then force logout
      setTimeout(() => {
        logout();
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'An error occurred while updating the password.');
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-emerald-50 rounded-2xl border border-emerald-100 max-w-2xl mx-auto mt-12 animate-in fade-in zoom-in duration-500">
        <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-4" />
        <h2 className="text-2xl font-bold text-emerald-900 mb-2">Password Updated Securely</h2>
        <p className="text-emerald-700 text-center">
          Your credentials have been updated and all other sessions have been invalidated.
          You will be redirected to log in again momentarily...
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <ShieldAlert className="w-6 h-6 mr-2 text-amber-600" />
          Root CEO Security Settings
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage your protected root credentials. Changing your password will invalidate all active sessions immediately.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Current Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <KeyRound className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 sm:text-sm"
                  placeholder="Enter current password"
                />
              </div>
            </div>

            <hr className="border-gray-100 my-6" />

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                New Password
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 sm:text-sm"
                placeholder="At least 8 characters"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 sm:text-sm"
                placeholder="Re-enter new password"
              />
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-100">
                {error}
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto flex justify-center items-center px-6 py-3 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Updating Credentials...' : 'Update Password securely'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
