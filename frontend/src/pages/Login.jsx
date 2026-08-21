import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { login as loginApi, getCsrfToken } from "../services/authService";
import ThreeBackground from "../components/Three/ThreeBackground";
import { cn } from "../utils/cn";

const MotionForm = motion.form;

export default function Login() {
  const [collegeId, setCollegeId] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { loginUser, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      // Pass role so backend can verify account type matches
      const data = await loginApi(collegeId, password, role);
      loginUser(data.user);
      navigate(`/${role}`);
    } catch (err) {
      // If CSRF token is stale (403), silently refresh it and show a friendly message
      if (err.response?.status === 403) {
        try { await getCsrfToken(); } catch { /* ignore */ }
        setError("Session expired. Please try signing in again.");
      } else {
        setError(err.response?.data?.error || err.response?.data?.detail || "Login failed. Please check your credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Demo accounts ship only when the build opts in (VITE_DEMO_MODE=true).
  // Keeps seeded recruiter credentials out of production bundles.
  const SHOW_DEMO_ACCOUNTS = import.meta.env.VITE_DEMO_MODE === 'true';

  const TEST_CREDENTIALS = {
    student: { id: 'CW-STUDENT', password: 'Password@123', name: 'Aarav Sharma' },
    faculty: { id: 'CW-FACULTY', password: 'Password@123', name: 'Dr. Rajesh Kumar' },
    admin:   { id: 'CW-ADMIN',   password: 'Password@123', name: 'ChatWave Admin' },
  };

  const fillCredentials = () => {
    const creds = TEST_CREDENTIALS[role];
    if (creds) {
      setCollegeId(creds.id);
      setPassword(creds.password);
    }
  };

  return (
    <div className="relative min-h-screen bg-cw-black flex items-center justify-center p-4 overflow-hidden">
      <ThreeBackground />

      {/* GLOW 1 (ambient) */}
      <div className="absolute -top-20 -left-20 w-96 h-96 rounded-full bg-cw-blue/[0.08] blur-[60px] pointer-events-none z-[1]" />
      
      {/* GLOW 2 */}
      <div className="absolute -bottom-10 -right-10 w-64 h-64 rounded-full bg-purple-500/[0.06] blur-[60px] pointer-events-none z-[1]" />

      <MotionForm
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-[400px] bg-[#0c0f17]/90 backdrop-blur-xl border border-white/[0.12] rounded-2xl p-8"
      >
        <div className="flex justify-center mb-5">
          <div 
            className="w-[72px] h-[72px] rounded-full animate-orb-spin flex items-center justify-center shadow-glow"
            style={{background:'conic-gradient(from 0deg,#1e40af,#3b82f6,#60a5fa,#0d9488,#1e40af)'}}
          >
            <div className="w-[52px] h-[52px] rounded-full bg-cw-black" />
          </div>
        </div>

        <h1 className="font-outfit text-[26px] font-bold text-center text-cw-t1 mb-1 tracking-tight">ChatWave</h1>

        <p className="text-xs text-cw-t3 text-center mb-6">Your college. Intelligently answered.</p>

        <div className="flex gap-2 mb-5">
          {['student', 'faculty', 'admin'].map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={cn(
                "flex-1 py-2 rounded-lg border font-dm text-[11px] font-medium cursor-pointer transition-all duration-150 capitalize",
                role === r
                  ? "bg-cw-blue/10 border-cw-blue/50 text-blue-300"
                  : "bg-transparent border-white/[0.07] text-cw-t3 hover:border-white/20 hover:text-cw-t2"
              )}
            >{r}</button>
          ))}
        </div>

        {/* Test credentials hint for recruiters (demo builds only) */}
        {SHOW_DEMO_ACCOUNTS && (
        <div className="mb-5 px-3 py-2.5 rounded-xl border border-white/[0.07] bg-white/[0.02]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-cw-t3 font-medium uppercase tracking-wider">
              Demo Account
            </span>
            <button
              type="button"
              onClick={fillCredentials}
              className="text-[10px] px-2.5 py-1 rounded-md bg-cw-blue/10 border border-cw-blue/25 text-blue-300 hover:bg-cw-blue/20 transition-all cursor-pointer font-dm"
            >
              ↗ Auto-fill
            </button>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-cw-t3">Name</span>
              <span className="text-[11px] text-cw-t1 font-medium">
                {TEST_CREDENTIALS[role].name}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-cw-t3">College ID</span>
              <span className="text-[11px] text-cw-blue-light font-mono">
                {TEST_CREDENTIALS[role].id}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-cw-t3">Password</span>
              <span className="text-[11px] text-cw-t2 font-mono">
                {TEST_CREDENTIALS[role].password}
              </span>
            </div>
          </div>
        </div>
        )}

        <div className="mb-2.5">
          <label className="block text-[11px] text-cw-t3 mb-1">College ID</label>
          <input
            type="text"
            value={collegeId}
            onChange={(e) => setCollegeId(e.target.value)}
            placeholder="Enter your college ID"
            className="cw-input"
          />
        </div>

        <div className="mb-2.5">
          <label className="block text-[11px] text-cw-t3 mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="cw-input"
          />
        </div>

        {error && (
          <p className="text-xs text-red-400 mb-2">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || authLoading}
          className="cw-btn-primary mb-3"
        >
          {loading || authLoading ? 'Signing in...' : 'Sign in to ChatWave'}
        </button>

        <p className="text-center text-[11px] text-cw-t3 my-3">— or —</p>

        <p
          onClick={() => navigate('/register')}
          className="text-center text-xs text-cw-blue-light cursor-pointer hover:underline"
        >Create a new account</p>
      </MotionForm>
    </div>
  );
}
