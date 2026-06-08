import React, { useState } from "react";
import { CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "../../utils/cn";

export default function CalendarButton({ detectedDate, dateEvent, onAdd }) {
  const [status, setStatus] = useState("idle");

  const handleClick = async () => {
    if (status !== "idle") return;
    setStatus("loading");
    try {
      await onAdd();
      setStatus("success");
    } catch (err) {
      console.error(err);
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  if (status === "success") {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] text-emerald-400 bg-emerald-500/[0.08] border border-emerald-500/20">
        <span>✓ Added to Calendar</span>
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={status === "loading"}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] cursor-pointer transition-all border",
        status === "error"
          ? "text-red-400 bg-red-500/[0.08] border-red-500/20"
          : "text-amber-400 bg-amber-500/[0.08] border-amber-500/20 hover:bg-amber-500/[0.14]"
      )}
    >
      {status === "loading"
        ? <Loader2 size={10} className="animate-spin" />
        : <CalendarIcon size={10} />
      }
      <span>
        {status === "error"
          ? "Failed to add"
          : `Add ${dateEvent || detectedDate} to Calendar`}
      </span>
    </button>
  );
}
