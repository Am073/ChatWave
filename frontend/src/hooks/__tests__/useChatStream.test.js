import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useChatStream } from '../useChatStream';

/**
 * useChatStream — verifies that:
 *  - WebSocket lifecycle is correctly managed.
 *  - Incoming frames update messages with the right shape.
 *  - `sendMessage` is a no-op when no user is logged in.
 *
 * The actual WebSocket is mocked at the global level so we don't need a
 * real server. The mock implements only the subset of the API the hook
 * actually uses.
 */

class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.sent = [];
    this._handlers = {};
    MockWebSocket.instances.push(this);
  }
  static instances = [];
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  on() {}
  set onopen(fn) { this._handlers.open = fn; }
  set onmessage(fn) { this._handlers.message = fn; }
  set onerror(fn) { this._handlers.error = fn; }
  set onclose(fn) { this._handlers.close = fn; }

  send(payload) {
    this.sent.push(JSON.parse(payload));
  }
  close() {
    this.readyState = MockWebSocket.CLOSED;
    this._handlers.close?.();
  }

  // Test helpers
  _open() {
    this.readyState = MockWebSocket.OPEN;
    this._handlers.open?.();
  }
  _receive(obj) {
    this._handlers.message?.({ data: JSON.stringify(obj) });
  }
  _close() {
    this.readyState = MockWebSocket.CLOSED;
    this._handlers.close?.();
  }
}

beforeEach(() => {
  MockWebSocket.instances = [];
  global.WebSocket = MockWebSocket;
});

afterEach(() => {
  delete global.WebSocket;
});

describe('useChatStream', () => {
  it('does not connect when no userId is provided', () => {
    const { result } = renderHook(() => useChatStream(null, 'Test College'));
    expect(result.current.connected).toBe(false);
    expect(MockWebSocket.instances).toHaveLength(0);
  });

  it('opens a WebSocket on mount when userId is set', async () => {
    const { result } = renderHook(() => useChatStream('user-1', 'Test College'));
    await waitFor(() => expect(MockWebSocket.instances.length).toBe(1));
    act(() => MockWebSocket.instances[0]._open());
    await waitFor(() => expect(result.current.connected).toBe(true));
  });

  it('appends a user message and bot placeholder on sendMessage', async () => {
    const { result } = renderHook(() => useChatStream('user-1', 'Test College'));
    await waitFor(() => expect(MockWebSocket.instances.length).toBe(1));
    act(() => MockWebSocket.instances[0]._open());
    await waitFor(() => expect(result.current.connected).toBe(true));

    act(() => result.current.sendMessage('What is the fee deadline?'));
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].role).toBe('user');
    expect(result.current.messages[1].role).toBe('bot');
    expect(MockWebSocket.instances[0].sent[0]).toMatchObject({
      type: 'question',
      content: 'What is the fee deadline?',
    });
  });

  it('handles a full answer flow with sources, tokens, and final', async () => {
    const { result } = renderHook(() => useChatStream('user-1', 'Test College'));
    await waitFor(() => expect(MockWebSocket.instances.length).toBe(1));
    act(() => MockWebSocket.instances[0]._open());
    await waitFor(() => expect(result.current.connected).toBe(true));

    act(() => result.current.sendMessage('Hello'));
    const botId = result.current.messages[1].id;

    act(() => {
      MockWebSocket.instances[0]._receive({
        type: 'sources',
        sources: [{ id: 'doc-1', title: 'Fees' }],
      });
      MockWebSocket.instances[0]._receive({ type: 'token', content: 'Hi ' });
      MockWebSocket.instances[0]._receive({ type: 'token', content: 'there' });
      MockWebSocket.instances[0]._receive({
        type: 'final',
        answer: 'Hi there',
        traceId: 't-1',
        model: 'gemini/gemini-2.0-flash',
        confidence: 'high',
        detectedDates: [
          { date: '2026-03-15', label: 'Exam date', context: '...', confidence: 0.95, raw: '2026-03-15', position: 0 },
        ],
      });
    });

    const bot = result.current.messages.find((m) => m.id === botId);
    expect(bot.content).toBe('Hi there');
    expect(bot.sources).toHaveLength(1);
    expect(bot.isDone).toBe(true);
    expect(bot.traceId).toBe('t-1');
    expect(bot.detectedDates).toHaveLength(1);
    expect(bot.detectedDates[0].date).toBe('2026-03-15');
    expect(result.current.isTyping).toBe(false);
  });

  it('sendMessage is a no-op when no user is logged in', () => {
    const { result } = renderHook(() => useChatStream(null, 'Test College'));
    act(() => result.current.sendMessage('Test'));
    expect(result.current.messages).toHaveLength(0);
  });
});
