import React, { useState, useEffect, useRef, useCallback } from "react";
import { useChatStream } from "../../hooks/useChatStream";
import api from "../../services/api";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import TypingIndicator from "./TypingIndicator";

const SUGGESTIONS = [
  'When is my next exam?',
  'What is the fee deadline?',
  'Any holidays this month?',
  'Show recent notices'
];

const STORAGE_KEY = "chatwave_messages";

function loadLocalMessages() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalMessages(msgs) {
  // Only keep the most recent 200 messages to avoid localStorage bloat
  const trimmed = msgs.slice(-200);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

export default function ChatWindow({ userId, collegeName }) {
  const {
    messages, setMessages, isTyping, connected,
    reconnectFailed, sendMessage: wsSendMessage, clearMessages, retryConnect,
  } = useChatStream(userId, collegeName);

  const scrollRef = useRef(null);
  const [searching, setSearching] = useState(false);
  const [mode, setMode] = useState('college');
  const [searchStatus, setSearchStatus] = useState('');
  // Infinite scroll state
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [cursor, setCursor] = useState(null);
  const loadedHistory = useRef(false);

  // ── Load history ONCE on mount (not on every render) ─────────────────
  useEffect(() => {
    if (loadedHistory.current || !userId) return;
    loadedHistory.current = true;

    const loadHistory = async () => {
      try {
        const res = await api.get("/chat/history", { params: { page: 1, limit: 30 } });
        const logs = res.data?.logs || [];
        if (logs.length > 0) {
          const historyMessages = logs
            .filter(log => log.answer && !log.answer.includes("I'm having trouble processing"))
            .reverse()
            .flatMap(log => [
              { id: `hist-user-${log._id || log.id}`, role: 'user', content: log.question, isHistory: true },
              {
                id: `hist-bot-${log._id || log.id}`, role: 'bot', content: log.answer,
                sources: log.sources || (log.source_reference ? JSON.parse(log.source_reference) : []),
                isHistory: true,
              }
            ]);
          setMessages(historyMessages);
          saveLocalMessages(historyMessages);

          // Set cursor for "load more" — timestamp of oldest loaded message
          const oldest = logs[0];
          if (oldest?.created_at) {
            setCursor(oldest.created_at);
            setHasMoreHistory(res.data?.has_more || logs.length === 30);
          }
        }
      } catch {
        // Fallback: load from localStorage (works offline, survives page refresh)
        const local = loadLocalMessages();
        if (local.length > 0) {
          setMessages(local);
        }
      }
    };

    loadHistory();
  }, [userId]);  // Only run once on mount

  // ── Persist messages to localStorage on every change ──────────────────
  useEffect(() => {
    if (messages.length > 0) {
      saveLocalMessages(messages);
    }
  }, [messages]);

  // ── Auto-scroll to bottom on new messages ─────────────────────────────
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping, searching]);

  useEffect(() => {
    if (isTyping) {
      setSearching(false);
      setSearchStatus('');
    }
  }, [isTyping]);

  // ── Load more history (infinite scroll) ───────────────────────────────
  const loadMoreHistory = useCallback(async () => {
    if (!cursor || loadingMore || !hasMoreHistory) return;
    setLoadingMore(true);
    try {
      const res = await api.get("/chat/history", { params: { before: cursor, limit: 30 } });
      const logs = res.data?.logs || [];
      if (logs.length === 0) {
        setHasMoreHistory(false);
        return;
      }
      const olderMessages = logs
        .filter(log => log.answer && !log.answer.includes("I'm having trouble processing"))
        .reverse()
        .flatMap(log => [
          { id: `hist-user-${log._id || log.id}`, role: 'user', content: log.question, isHistory: true },
          {
            id: `hist-bot-${log._id || log.id}`, role: 'bot', content: log.answer,
            sources: log.sources || (log.source_reference ? JSON.parse(log.source_reference) : []),
            isHistory: true,
          }
        ]);
      // Prepend older messages to the top
      setMessages(prev => [...olderMessages, ...prev]);
      // Update cursor
      const oldest = logs[0];
      if (oldest?.created_at) {
        setCursor(oldest.created_at);
      }
      setHasMoreHistory(res.data?.has_more || logs.length === 30);
    } catch (err) {
      console.error("Failed to load more history:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore, hasMoreHistory]);

  // ── Infinite scroll detection ( Intersection Observer ) ───────────────
  const sentinelRef = useRef(null);
  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreHistory && !loadingMore) {
          loadMoreHistory();
        }
      },
      { root: scrollRef.current, threshold: 0.1 }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMoreHistory, loadingMore, loadMoreHistory]);

  // FIX[7]: Removed duplicate user message append — useChatStream.sendMessage
  // already adds the optimistic user message and bot placeholder.
  const sendMessage = (question) => {
    if (!question.trim() || isTyping || searching) return;
    setSearching(true);
    setSearchStatus(
      mode === 'general'
        ? 'Thinking...'
        : 'Searching knowledge base...'
    );
    wsSendMessage(question, mode);
  };

  // Calendar integration is now driven by BulkDatePicker; the chat
  // component no longer needs to issue the API call directly. We keep
  // the prop so ChatMessage can call us back when the modal closes
  // (e.g. to refresh a list or show a toast).
  const handleAddCalendar = async () => {
    // No-op: BulkDatePicker handles the API call + result UI.
  };

  // Clear messages from DB, React state, AND localStorage
  const handleClearMessages = useCallback(async () => {
    try {
      await api.delete('/chat/history');
    } catch (err) {
      console.error('Failed to clear chat history from DB:', err);
    }
    clearMessages();
    localStorage.removeItem(STORAGE_KEY);
    loadedHistory.current = false; // allow re-check on next mount
  }, [clearMessages]);

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Chat header */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 bg-[#0c0f17]/90 border-b border-white/[0.07] shrink-0">
        <div className="w-[34px] h-[34px] rounded-[9px] shrink-0 flex items-center justify-center text-xs font-bold text-white font-outfit bg-gradient-to-br from-blue-800 to-cw-teal">
          CW
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-cw-t1 font-dm">ChatWave AI</div>
          <div className="flex items-center gap-1.5 mt-px">
            <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-400'}`} />
            <span className={`text-[10px] ${connected ? 'text-cw-teal' : 'text-red-400'}`}>
              {connected
                ? mode === 'general'
                  ? 'Online · General AI mode'
                  : 'Online · Answers from your college only'
                : 'Reconnecting...'}
            </span>
          </div>
        </div>

        {/* Mode toggle */}
        <div className="flex items-center rounded-lg border border-white/[0.10] bg-white/[0.03] p-0.5 shrink-0">
          <button
            onClick={() => setMode('college')}
            className={`px-2.5 py-1 rounded-md text-[10px] font-dm font-medium transition-all cursor-pointer ${
              mode === 'college'
                ? 'bg-cw-blue/20 text-blue-300 border border-cw-blue/30'
                : 'text-cw-t3 hover:text-cw-t2'
            }`}
            title="Answer from college documents only"
          >
            🎓 College
          </button>
          <button
            onClick={() => setMode('general')}
            className={`px-2.5 py-1 rounded-md text-[10px] font-dm font-medium transition-all cursor-pointer ${
              mode === 'general'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-cw-t3 hover:text-cw-t2'
            }`}
            title="Answer any general question"
          >
            🌐 General
          </button>
        </div>

        {/* Clear button — clears UI + localStorage */}
        <button
          onClick={handleClearMessages}
          title="Clear chat"
          className="px-2.5 py-1 rounded-md border border-white/[0.10] bg-white/[0.04] text-cw-t3 font-dm text-[11px] cursor-pointer transition-all hover:border-red-400/40 hover:text-red-300 hover:bg-red-500/[0.06] flex items-center gap-1 shrink-0"
        >🗑 Clear</button>
      </div>

      {/* Reconnect banner */}
      {!connected && (
        <div className="bg-amber-500/20 text-amber-200 text-[10px] px-4 py-1 text-center border-b border-amber-500/20">
          ⚠️ Connection lost. Reconnecting to ChatWave...
        </div>
      )}

      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto no-scrollbar p-4 flex flex-col gap-3.5"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center flex-1 gap-3 p-8">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white font-outfit bg-gradient-to-br from-blue-800 to-cw-teal">
              CW
            </div>
            <div className="text-center">
              <div className="font-outfit text-base font-semibold text-cw-t1 mb-1.5">How can I help you today?</div>
              <div className="text-xs text-cw-t3 max-w-[280px] leading-relaxed">
                Ask me anything about your college — exams, fees, holidays, timetables, or any uploaded document.
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 justify-center mt-2">
              {SUGGESTIONS.map(suggestion => (
                <button
                  key={suggestion}
                  onClick={() => sendMessage(suggestion)}
                  className="px-3 py-1.5 rounded-full border border-cw-blue/30 bg-cw-blue/[0.06] text-blue-300 text-[11px] font-dm cursor-pointer hover:bg-cw-blue/[0.12] transition-all"
                >{suggestion}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <ChatMessage key={msg.id} message={msg} onAddCalendar={handleAddCalendar} />
        ))}

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} className="h-4" />

        {loadingMore && (
          <div className="flex items-center gap-2 text-cw-t3 text-[11px] font-dm px-2">
            <div className="w-3 h-3 rounded-full border-2 border-cw-teal border-t-transparent animate-spin" />
            Loading older messages...
          </div>
        )}

        {searching && !isTyping && (
          <div className="flex gap-2 items-start">
            <div className="w-7 h-7 rounded-lg shrink-0 bg-gradient-to-br from-blue-800 to-cw-teal flex items-center justify-center text-[10px] font-bold text-white font-outfit">
              CW
            </div>
            <div className="px-3.5 py-2.5 rounded-xl rounded-tl-sm bg-cw-card border border-white/[0.08] flex items-center gap-2">
              <div className="w-3 h-3 rounded-full border-2 border-cw-teal border-t-transparent animate-spin"/>
              <span className="text-[12px] text-cw-t3 font-dm">
                {searchStatus}
              </span>
            </div>
          </div>
        )}

        {isTyping && <TypingIndicator />}
      </div>

      {/* Input area */}
      <div className="px-4 py-3 border-t border-white/[0.07] shrink-0">
        {reconnectFailed ? (
          <div className="flex items-center justify-between gap-2 text-[12px] font-dm">
            <span className="text-red-400">Connection lost. Please refresh or try reconnecting.</span>
            <button
              onClick={retryConnect}
              className="px-3 py-1 rounded-md bg-cw-teal/20 text-cw-teal hover:bg-cw-teal/30 transition-colors text-[11px] font-medium cursor-pointer"
            >Reconnect</button>
          </div>
        ) : (
          <ChatInput onSend={sendMessage} disabled={!connected || isTyping} />
        )}
      </div>
    </div>
  );
}