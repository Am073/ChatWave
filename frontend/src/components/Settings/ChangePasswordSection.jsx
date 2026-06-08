import React, { useState } from "react";
import { changePassword } from "../../services/authService";

export default function ChangePasswordSection() {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    if (newPassword.length < 8) { setError("New password must be at least 8 characters"); return; }
    if (newPassword !== confirmPassword) { setError("Passwords do not match"); return; }
    setLoading(true);
    try {
      await changePassword(oldPassword, newPassword);
      setSuccess(true);
      setOldPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-2xl border border-white/[0.07] bg-cw-card">
      <div className="px-4 py-2.5 border-b border-white/[0.07]">
        <span className="cw-section-header">Security</span>
      </div>

      <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-2.5">
        <input type="password" placeholder="Current Password"
          value={oldPassword} onChange={e => setOldPassword(e.target.value)}
          className="cw-input" required />
        <input type="password" placeholder="New Password"
          value={newPassword} onChange={e => setNewPassword(e.target.value)}
          className="cw-input" required />
        <input type="password" placeholder="Confirm New Password"
          value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
          className="cw-input" required />

        {error && <p className="text-xs text-red-400">{error}</p>}
        {success && <p className="text-xs text-emerald-400">✓ Password updated successfully</p>}

        <button type="submit" disabled={loading}
          className="w-full py-2 rounded-xl bg-cw-blue text-white text-xs font-dm font-medium cursor-pointer hover:opacity-90 transition-opacity border-none disabled:opacity-50 mt-1">
          {loading ? "Updating..." : "Update Password"}
        </button>
      </form>
    </section>
  );
}
