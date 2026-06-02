import { describe, it, expect, vi } from "vitest";
import { EventBus } from "../event-bus";

describe("EventBus", () => {
  it("subscribes and emits to a single handler", () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.on("ride:started", handler);
    bus.emit("ride:started", { classId: "test", duration: 45 });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ classId: "test", duration: 45 });
  });

  it("subscribes and emits to multiple handlers for the same event", () => {
    const bus = new EventBus();
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    bus.on("ride:paused", handler1);
    bus.on("ride:paused", handler2);
    bus.emit("ride:paused", {});

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it("unsubscribes when the returned function is called", () => {
    const bus = new EventBus();
    const handler = vi.fn();

    const unsub = bus.on("ride:started", handler);
    unsub();
    bus.emit("ride:started", { classId: "test", duration: 45 });

    expect(handler).not.toHaveBeenCalled();
  });

  it("does not emit after dispose", () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.on("lifecycle:tick", handler);
    bus.dispose();
    bus.emit("lifecycle:tick", { elapsed: 10, progress: 0.5 });

    expect(handler).not.toHaveBeenCalled();
  });

  it("handles errors in handlers without breaking subsequent handlers", () => {
    const bus = new EventBus();
    const throwingHandler = vi.fn(() => {
      throw new Error("handler error");
    });
    const safeHandler = vi.fn();

    bus.on("ride:started", throwingHandler);
    bus.on("ride:started", safeHandler);

    expect(() => {
      bus.emit("ride:started", { classId: "test", duration: 45 });
    }).not.toThrow();

    expect(throwingHandler).toHaveBeenCalledTimes(1);
    expect(safeHandler).toHaveBeenCalledTimes(1);
  });

  it("allows subscribing after multiple emits", () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.emit("ride:paused", {});
    bus.on("ride:paused", handler);
    bus.emit("ride:paused", {});

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("supports multiple event types independently", () => {
    const bus = new EventBus();
    const startHandler = vi.fn();
    const tickHandler = vi.fn();
    const completeHandler = vi.fn();

    bus.on("ride:started", startHandler);
    bus.on("lifecycle:tick", tickHandler);
    bus.on("lifecycle:complete", completeHandler);

    bus.emit("ride:started", { classId: "c1", duration: 30 });
    bus.emit("lifecycle:tick", { elapsed: 5, progress: 0.1 });
    bus.emit("ride:started", { classId: "c2", duration: 45 });

    expect(startHandler).toHaveBeenCalledTimes(2);
    expect(tickHandler).toHaveBeenCalledTimes(1);
    expect(completeHandler).not.toHaveBeenCalled();
  });

  it("returns a no-op unsubscribe after dispose", () => {
    const bus = new EventBus();
    const handler = vi.fn();

    const unsub = bus.on("ride:started", handler);
    bus.dispose();

    // Calling unsub after dispose should not throw
    expect(() => unsub()).not.toThrow();

    bus.emit("ride:started", { classId: "test", duration: 45 });
    expect(handler).not.toHaveBeenCalled();
  });

  it("clears all handlers on dispose", () => {
    const bus = new EventBus();
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    bus.on("ride:started", handler1);
    bus.on("lifecycle:tick", handler2);
    bus.dispose();

    bus.emit("ride:started", { classId: "test", duration: 45 });
    bus.emit("lifecycle:tick", { elapsed: 10, progress: 0.5 });

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).not.toHaveBeenCalled();
  });
});
