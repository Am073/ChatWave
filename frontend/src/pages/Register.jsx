import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { register } from "../services/authService";

export default function Register() {
  const [name, setName] = useState('')
  const [collegeId, setCollegeId] = useState('')
  const [password, setPassword] = useState('')
  const [collegeName, setCollegeName] = useState('')
  const [department, setDepartment] = useState('')
  const [role, setRole] = useState('student')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      setLoading(false);
      return;
    }

    try {
      await register({ 
        name, 
        college_id: collegeId, 
        password, 
        college_name: collegeName, 
        department, 
        role 
      });
      setSuccess('Account created! Redirecting...');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-cw-black flex items-center justify-center p-6 overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute -top-20 -left-20 w-96 h-96 rounded-full bg-cw-blue/[0.07] blur-[60px] pointer-events-none z-[1]" />
      <div className="absolute -bottom-10 -right-10 w-64 h-64 rounded-full bg-purple-500/[0.05] blur-[60px] pointer-events-none z-[1]" />

      {/* Main card */}
      <form onSubmit={handleSubmit} className="relative z-10 w-full max-w-[420px] bg-[#0c0f17]/92 backdrop-blur-xl border border-white/[0.12] rounded-2xl p-8">
        <h1 className="font-outfit text-xl font-bold text-center text-cw-t1 mb-1">Create Account</h1>

        <p className="text-xs text-cw-t3 text-center mb-6">Join your college on ChatWave</p>

        {/* Field 1: Full Name */}
        <div className="mb-2.5">
          <label className="block text-[11px] text-cw-t3 mb-1">Full Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="John Doe"
            className="cw-input"
          />
        </div>

        {/* Field 2: College ID */}
        <div className="mb-2.5">
          <label className="block text-[11px] text-cw-t3 mb-1">College ID</label>
          <input
            type="text"
            value={collegeId}
            onChange={(e) => setCollegeId(e.target.value)}
            placeholder="e.g. CS2021045"
            className="cw-input"
          />
        </div>

        {/* Field 3: Password */}
        <div className="mb-2.5">
          <label className="block text-[11px] text-cw-t3 mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 8 characters"
            className="cw-input"
          />
        </div>

        {/* Field 4: College Name */}
        <div className="mb-2.5">
          <label className="block text-[11px] text-cw-t3 mb-1">College Name</label>
          <input
            type="text"
            value={collegeName}
            onChange={(e) => setCollegeName(e.target.value)}
            placeholder="Your college name"
            className="cw-input"
          />
        </div>

        {/* Field 5: Department */}
        <div className="mb-2.5">
          <label className="block text-[11px] text-cw-t3 mb-1">Department</label>
          <input
            type="text"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="e.g. Computer Science"
            className="cw-input"
          />
        </div>

        {/* Field 6: Role */}
        <div className="mb-2.5">
          <label className="block text-[11px] text-cw-t3 mb-1">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="cw-input bg-cw-card cursor-pointer"
          >
            <option value="student">Student</option>
            <option value="faculty">Faculty</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        {/* Error message */}
        {error && (
          <p className="text-xs text-red-400 mb-2 flex items-center gap-1">{error}</p>
        )}

        {/* Success message */}
        {success && (
          <p className="text-xs text-emerald-400 mb-2 flex items-center gap-1">{success}</p>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={loading}
          className="cw-btn-primary mt-2 mb-3"
        >
          {loading ? 'Creating account...' : 'Create Account'}
        </button>

        {/* Sign in link */}
        <p
          onClick={() => navigate('/login')}
          className="text-center text-xs text-cw-blue-light cursor-pointer hover:underline mt-1"
        >Already have an account? Sign in</p>
      </form>
    </div>
  );
}
