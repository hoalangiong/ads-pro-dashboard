const store = new Map();

// ttl in seconds
export function get(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) { store.delete(key); return null; }
  return entry.value;
}

export function set(key, value, ttl = 300) {
  store.set(key, { value, expires: Date.now() + ttl * 1000 });
}

export function del(key) { store.delete(key); }

export function clear() { store.clear(); }
