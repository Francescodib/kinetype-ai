export class ObjectPool<T> {
  private readonly pool: T[] = [];
  private readonly factory: () => T;
  private readonly reset: (obj: T) => void;

  constructor(factory: () => T, reset: (obj: T) => void, prewarm = 0) {
    this.factory = factory;
    this.reset = reset;
    for (let i = 0; i < prewarm; i++) {
      this.pool.push(factory());
    }
  }

  acquire(): T {
    return this.pool.length > 0 ? this.pool.pop()! : this.factory();
  }

  release(obj: T): void {
    this.reset(obj);
    this.pool.push(obj);
  }

  get available(): number {
    return this.pool.length;
  }
}
