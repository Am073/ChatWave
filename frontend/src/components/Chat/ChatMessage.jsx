import React from "react";
import { useAuth } from "../../context/AuthContext";
import CalendarButton from "./CalendarButton";
import { cn } from "../../utils/cn";

export default function ChatMessage({ message, onAddCalendar }) {
  const { user } = useAuth();
  const isBot = message.role === 'bot';
  const initials = isBot ? 'CW' : (user?.name?.charAt(0) || 'U');

  return (
    <div className={cn("flex gap-2 items-start", !isBot && "flex-row-reverse")}>
      {/* Avatar */}
      <div className={cn(
        "w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-[10px] font-bold text-white font-outfit",
        isBot ? "bg-gradient-to-br from-blue-800 to-cw-teal" : "bg-gradient-to-br from-emerald-900 to-emerald-500"
      )}>
        {initials}
      </div>

      {/* Content */}
      <div className="max-w-[75%] flex flex-col gap-1">
        {/* Bubble */}
        <div className={cn(
          "px-3 py-2 text-sm leading-relaxed font-dm break-words",
          isBot
            ? "bg-[#161b27] border border-white/[0.08] rounded-xl rounded-tl-sm text-cw-t1"
            : "bg-cw-blue/25 border border-cw-blue/30 rounded-xl rounded-tr-sm text-blue-200"
        )}>
          {message.content}
        </div>

        {/* Source badge */}
        {isBot && message.sources && message.sources.length > 0 && (
          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-cw-teal bg-cw-teal/[0.08] border border-cw-teal/20 w-fit">
            📌 {message.sources[0]?.name || 'College document'}
          </div>
        )}

        {/* Calendar button */}
        {isBot && message.detectedDate && (
          <CalendarButton
            detectedDate={message.detectedDate}
            dateEvent={message.dateEvent}
            onAdd={() => onAddCalendar && onAddCalendar(message.detectedDate, message.dateEvent)}
          />
        )}
      </div>
    </div>
  );
}
