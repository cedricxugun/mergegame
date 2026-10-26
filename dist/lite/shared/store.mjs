// Local save plus playtest metrics. Metrics never leave the device; the
// settings panel shows them so a facilitator can read them after a session.
export function createStore(saveKey, version) {
  const params = new URLSearchParams(location.search);
  if (params.has('fresh')) { try { localStorage.removeItem(saveKey); } catch { /* private mode */ } }
  return {
    load(fallback) {
      try { const data = JSON.parse(localStorage.getItem(saveKey) || 'null'); return data?.version === version ? data : fallback(); }
      catch { return fallback(); }
    },
    save(data) { try { localStorage.setItem(saveKey, JSON.stringify({...data, version})); return true; } catch { return false; } },
    reset() { try { localStorage.removeItem(saveKey); } catch { /* ignore */ } }
  };
}

export function createMetrics(seed = {}) {
  const m = {counters: {}, timers: {}, events: [], startedAt: Date.now(), ...seed};
  let scene = null, since = 0;
  return {
    data: m,
    count(name, n = 1) { m.counters[name] = (m.counters[name] || 0) + n; },
    event(name, detail = {}) { m.events.push({t: Math.round((Date.now() - m.startedAt) / 1000), name, ...detail}); if (m.events.length > 300) m.events.shift(); },
    // Time is attributed to whichever screen is visible.
    enter(name) { const now = performance.now(); if (scene) m.timers[scene] = (m.timers[scene] || 0) + (now - since) / 1000; scene = name; since = now; },
    flush() { this.enter(scene); },
    summary() {
      this.flush();
      const t = Object.fromEntries(Object.entries(m.timers).map(([k, v]) => [k, Math.round(v)]));
      return {...m.counters, ...Object.fromEntries(Object.entries(t).map(([k, v]) => ['秒·' + k, v]))};
    }
  };
}
