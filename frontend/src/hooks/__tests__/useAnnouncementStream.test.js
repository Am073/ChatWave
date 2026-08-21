import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAnnouncementStream } from "../useAnnouncementStream";

class MockEventSource {
  constructor(url) {
    this.url = url;
    this.listeners = {};
    MockEventSource.instances.push(this);
  }
  addEventListener(name, fn) {
    this.listeners[name] = fn;
  }
  close() {
    this.closed = true;
  }
  emit(name, data) {
    this.listeners[name]?.({ data: JSON.stringify(data) });
  }
}
MockEventSource.instances = [];

describe("useAnnouncementStream", () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    vi.useFakeTimers();
    vi.stubGlobal("EventSource", MockEventSource);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("does not connect without a userId", () => {
    renderHook(() => useAnnouncementStream(null));
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it("connects and surfaces pushed announcements with unread count", () => {
    const { result } = renderHook(() => useAnnouncementStream("u1"));
    const es = MockEventSource.instances[0];

    act(() => es.emit("ready", { tenant: "TestU" }));
    expect(result.current.connected).toBe(true);

    const ann = { _id: "a1", title: "Exam", createdAt: "2026-01-01" };
    act(() =>
      es.emit("announcement", {
        type: "announcement.created",
        announcement: ann,
      })
    );

    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].announcement._id).toBe("a1");
    expect(result.current.unread).toBe(1);

    act(() => result.current.markAllRead());
    expect(result.current.unread).toBe(0);
  });

  it("ignores malformed frames without crashing", () => {
    const { result } = renderHook(() => useAnnouncementStream("u1"));
    const es = MockEventSource.instances[0];
    act(() => es.listeners.announcement({ data: "not-json" }));
    expect(result.current.events).toHaveLength(0);
  });

  it("reconnects after an error", () => {
    renderHook(() => useAnnouncementStream("u1"));
    expect(MockEventSource.instances).toHaveLength(1);
    const es = MockEventSource.instances[0];
    act(() => es.listeners.error(new Event("error")));
    act(() => vi.advanceTimersByTime(3100));
    expect(MockEventSource.instances).toHaveLength(2);
    expect(es.closed).toBe(true);
  });
});
