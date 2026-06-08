import React, { useState } from "react";

export default function ChatInput({ onSend, disabled }) {
  const [value, setValue] = useState("");

  const doSend = () => {
    if (value.trim() && !disabled) {
      onSend(value.trim());
      setValue("");
    }
  };

  return (
    <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-cw-card border border-white/[0.12] rounded-xl transition-colors focus-within:border-cw-blue/40">
      <input
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') doSend(); }}
        placeholder="Ask anything about your college..."
        disabled={disabled}
        className="flex-1 bg-transparent border-none outline-none text-cw-t2 font-dm text-sm placeholder:text-cw-t3 disabled:cursor-not-allowed"
      />
      <button
        onClick={doSend}
        disabled={disabled}
        className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-sm text-white border-none cursor-pointer transition-all bg-cw-blue hover:opacity-90 disabled:bg-cw-card disabled:opacity-50 disabled:cursor-not-allowed"
      >→</button>
    </div>
  );
}
