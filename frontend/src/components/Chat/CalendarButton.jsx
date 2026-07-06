import React from "react";
import { CalendarIcon } from "lucide-react";

// FIX[8]: Calendar backend routes return 501 Not Implemented.
// Replaced with a Coming Soon placeholder badge.

export default function CalendarButton() {
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] text-cw-t3 bg-white/[0.04] border border-white/[0.08]">
      <CalendarIcon size={10} />
      <span>Calendar — Coming Soon</span>
    </div>
  );
}
