// Lets CLASS HUB run on Supabase: provides the same small database / user / upload API the page already uses.
(() => {
let sb; try { sb = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY); } catch (e) { window.__err = 'Config error (check SUPABASE_URL and SUPABASE_ANON_KEY): ' + e.message; return; }
const T = 'docs', B = 'class-files';
const err = e => ({ code: 'error', message: (e && e.message) || 'Something went wrong' });
const par = p => p.split('/').slice(0, -1).join('/'), last = p => p.split('/').pop();
const recent = new Map(), mark = p => recent.set(p, Date.now()), pend = p => Date.now() - (recent.get(p) || 0) < 4000;
const ds = r => ({ id: last(r.path), exists: true, data: () => JSON.parse(JSON.stringify(r.data)), metadata: { hasPendingWrites: pend(r.path), fromCache: false } });
const none = p => ({ id: last(p), exists: false, data: () => undefined, metadata: { hasPendingWrites: false, fromCache: false } });
const listen = (filter, cb) => { const ch = sb.channel('r' + Math.random().toString(36).slice(2)).on('postgres_changes', { event: '*', schema: 'public', table: T, filter }, () => cb()).subscribe(); return () => sb.removeChannel(ch); };
const doc = p => ({
  id: last(p), path: p,
  async get() { const { data, error } = await sb.from(T).select('path,data').eq('path', p).maybeSingle(); if (error) throw err(error); return data ? ds(data) : none(p); },
  async set(d) { mark(p); const { data, error } = await sb.from(T).update({ data: d, updated_at: new Date().toISOString() }).eq('path', p).select('path'); if (error) throw err(error); if (data && data.length) return; const r = await sb.from(T).insert({ path: p, parent: par(p), data: d }); if (r.error) throw err(r.error); },
  async update(d) { const s = await this.get(); return this.set({ ...(s.exists ? s.data() : {}), ...d }); },
  async delete() { mark(p); const { error } = await sb.from(T).delete().eq('path', p); if (error) throw err(error); },
  onSnapshot(next, errf) { let on = 1; const run = () => this.get().then(s => on && next(s)).catch(e => errf && errf(e)); run(); const off = listen('path=eq.' + p, run); return () => { on = 0; off(); }; }
});
const col = (p, o = {}) => ({
  path: p, doc: id => doc(p + '/' + id),
  orderBy: (f, dir) => col(p, { ...o, ob: [f, dir] }), limit: n => col(p, { ...o, lim: n }),
  async get() { let q = sb.from(T).select('path,data').eq('parent', p); if (o.ob) q = q.order('data->' + o.ob[0], { ascending: o.ob[1] != 'desc' }); if (o.lim) q = q.limit(o.lim); const { data, error } = await q; if (error) throw err(error); const docs = (data || []).map(ds); return { docs, size: docs.length, empty: !docs.length, docChanges: () => docs.map((d, i) => ({ type: 'added', doc: d, newIndex: i })), metadata: {} }; },
  onSnapshot(next, errf) {
    let prev = null, on = 1;
    const run = () => this.get().then(s => { if (!on) return; const m = new Map(s.docs.map(d => [d.id, JSON.stringify(d.data())])), ch = [];
      s.docs.forEach(d => { if (!prev || !prev.has(d.id)) ch.push({ type: 'added', doc: d }); else if (prev.get(d.id) != m.get(d.id)) ch.push({ type: 'modified', doc: d }); });
      if (prev) prev.forEach((v, id) => { if (!m.has(id)) ch.push({ type: 'removed', doc: { id } }); });
      prev = m; next({ ...s, docChanges: () => ch }); }).catch(e => errf && errf(e));
    run(); const off = listen('parent=eq.' + p, run); return () => { on = 0; off(); };
  }
});
const auth = async () => {
  const { data: { session } } = await sb.auth.getSession(); if (session) return session.user;
  const { data, error } = await sb.auth.signInAnonymously(); if (error) { window.__err = 'Sign-in error: ' + error.message; throw err(error); } return data.user;
};
const room = uid => { const ch = sb.channel('online', { config: { presence: { key: uid } } }); let f = () => {}; ch.on('presence', { event: 'sync' }, () => f({ peers: Object.keys(ch.presenceState()) })); ch.subscribe(s => { if (s == 'SUBSCRIBED') ch.track({ here: 1 }); }); return { presence() {}, onPeers(fn) { f = fn; } }; };
let U;
window.claudeBlob = async id => { const { data, error } = await sb.storage.from(B).download(id); if (error) throw err(error); return data; };
window.claude = { async use(n) {
  if (n == 'user') { U = U || await auth(); return { id: async () => U.id, canEdit: () => false, isOwner: () => false, can: () => true }; }
  if (n == 'db') return { collection: p => col(p), doc: p => doc(p) };
  if (n == 'assets') return { upload: async f => { const cid = typeof CID == 'string' ? CID : ''; if (!cid) throw { code: 'noaccess' }; const id = cid + '/' + crypto.randomUUID() + '-' + f.name.replace(/[^\w.\-]/g, '_'); const { error } = await sb.storage.from(B).upload(id, f, { contentType: f.type || undefined }); if (error) throw { code: 'upload', message: error.message }; return { id, url: '', sizeBytes: f.size, contentType: f.type }; } };
  if (n == 'downloads') return { save: async ({ filename, data }) => { const a = document.createElement('a'); a.href = URL.createObjectURL(data); a.download = filename; document.body.appendChild(a); a.click(); a.remove(); } };
  if (n == 'room') { U = U || await auth(); return room(U.id); }
  return null;
} };
})();
