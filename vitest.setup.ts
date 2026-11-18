// Node >=22 exposes `localStorage`/`Storage` as globals but leaves storage
// unusable unless started with --localstorage-file. Tests run in the node
// environment, so replace the stubs with a minimal in-memory implementation.
// Defining `Storage` as the shim class (not just the instance) keeps
// `vi.spyOn(Storage.prototype, ...)` working.
class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    this.map.set(key, String(value));
  }
}

if (typeof globalThis.localStorage === "undefined") {
  Object.defineProperty(globalThis, "Storage", {
    value: MemoryStorage,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(globalThis, "localStorage", {
    value: new MemoryStorage(),
    writable: true,
    configurable: true,
  });
  Object.defineProperty(globalThis, "sessionStorage", {
    value: new MemoryStorage(),
    writable: true,
    configurable: true,
  });
}
