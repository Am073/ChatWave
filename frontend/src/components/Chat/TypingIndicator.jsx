import React from "react";

export default function TypingIndicator() {
  return (
    <div className="flex gap-2 items-start">
      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-800 to-cw-teal flex items-center justify-center text-[10px] font-bold text-white font-outfit shrink-0">
        CW
      </div>

      <div className="px-3 py-2 rounded-xl rounded-tl-sm bg-[#161b27] border border-white/[0.08] flex gap-1 items-center">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-cw-t3 animate-pulse-dot"
            style={{ animationDelay: `${i * 0.2}s` }} // exception: animation delay must be inline
          />
        ))}
      </div>
    </div>
  );
}
