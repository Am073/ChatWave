import React, { useEffect, useState, useCallback } from 'react';
import {
  getModelStatus,
  setModel,
  clearModel,
} from '../../services/adminService';

/**
 * Admin Model Switcher.
 *
 * Lets the admin:
 *  - See the active chat model.
 *  - Switch to any model in the available catalog (e.g. from Gemini to Claude).
 *  - Clear the override and revert to the default.
 */
export default function ModelSwitcher() {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const { data } = await getModelStatus();
      setStatus(data);
    } catch (err) {
      setError(err?.response?.data?.error || err.message);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSelect = useCallback(
    async (model) => {
      setBusy(true);
      setError(null);
      try {
        const { data } = await setModel(model);
        setStatus(data);
      } catch (err) {
        setError(err?.response?.data?.error || err.message);
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const handleClear = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const { data } = await clearModel();
      setStatus(data);
    } catch (err) {
      setError(err?.response?.data?.error || err.message);
    } finally {
      setBusy(false);
    }
  }, []);

  if (!status) {
    return (
      <div className="rounded-2xl border border-white/[0.07] bg-cw-card p-4 text-[11px] text-cw-t3 font-dm">
        Loading model status…
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-white/[0.07] bg-cw-card">
      <div className="px-4 py-2.5 border-b border-white/[0.07]">
        <span className="cw-section-header">AI Model</span>
      </div>
      <div className="p-4 flex flex-col gap-3">
        <div className="text-[11px] text-cw-t3 font-dm">
          Active: <span className="text-cw-t1 font-medium">{status.active_model}</span>
        </div>
        <div className="text-[10px] text-cw-t3 font-dm">
          Default: <span className="text-cw-t2">{status.default_model}</span> · Providers:{' '}
          {status.available_providers?.join(', ') || 'none'}
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/[0.06] px-3 py-2 text-[11px] text-red-300">
            {error}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {(status.available_models || []).map((model) => (
            <button
              key={model}
              onClick={() => handleSelect(model)}
              disabled={busy || model === status.active_model}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-dm border transition-all ${
                model === status.active_model
                  ? 'bg-cw-teal/20 text-cw-teal border-cw-teal/40'
                  : 'border-cw-blue/30 bg-cw-blue/[0.06] text-blue-300 hover:bg-cw-blue/[0.12]'
              } disabled:opacity-50`}
            >
              {model}
            </button>
          ))}
        </div>

        {status.active_model !== status.default_model && (
          <button
            onClick={handleClear}
            disabled={busy}
            className="self-start px-3 py-1.5 rounded-lg border border-white/[0.10] bg-white/[0.04] text-cw-t3 text-[11px] font-dm hover:border-red-400/40 hover:text-red-300"
          >
            Reset to default
          </button>
        )}
      </div>
    </section>
  );
}
