import React from "react";
import { formatDate } from "../../utils/dateHelpers";

export default function SourceBadge({ sources }) {
  if (!sources || sources.length === 0) return null;
  const source = sources[0];

  return (
    <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-cw-teal bg-cw-teal/[0.08] border border-cw-teal/20">
      <span>📌</span>
      <span className="font-medium truncate max-w-[150px]">
        {source.name}
        {source.date && <span className="opacity-60 ml-1">— {formatDate(source.date)}</span>}
      </span>
    </div>
  );
}
