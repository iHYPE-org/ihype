'use client';
import { useEffect, useState } from 'react';

interface FR { id: string; title: string; description: string; votes: number; status: string; createdAt: string; }

export default function FeedbackPage() {
  const [requests, setRequests] = useState<FR[]>([]);
  const [title, setTitle] = useState(''); const [desc, setDesc] = useState(''); const [msg, setMsg] = useState('');

  useEffect(() => { fetch('/api/feedback').then(r => r.json()).then(d => setRequests(d.requests ?? [])); }, []);

  async function vote(id: string) {
    const r = await fetch('/api/feedback', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ action: 'vote', id }) });
    if (r.ok) { const d = await r.json(); setRequests(prev => prev.map(x => x.id === id ? {...x, votes: d.votes} : x).sort((a,b) => b.votes - a.votes)); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch('/api/feedback', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ title, description: desc }) });
    if (r.ok) { setMsg('Submitted! Thanks.'); setTitle(''); setDesc(''); const d = await r.json(); setRequests(prev => [d.request, ...prev]); }
    else { const d = await r.json(); setMsg(d.error ?? 'Error.'); }
  }

  return (
    <div className="container section">
      <h1 className="title">Feature Requests</h1>
      <p className="subtitle">Vote on ideas or suggest your own.</p>
      <form onSubmit={submit} className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
        <input className="input" placeholder="Short title" required value={title} onChange={e => setTitle(e.target.value)} />
        <textarea className="input" placeholder="Describe the feature..." required rows={3} value={desc} onChange={e => setDesc(e.target.value)} />
        {msg && <p className="meta">{msg}</p>}
        <button className="button" type="submit">Submit idea</button>
      </form>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {requests.map(fr => (
          <div className="panel" key={fr.id} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <button className="button small secondary" onClick={() => vote(fr.id)} style={{ minWidth: 48, flexShrink: 0 }}>▲ {fr.votes}</button>
            <div>
              <strong>{fr.title}</strong>
              <p className="meta" style={{ margin: '4px 0 0' }}>{fr.description}</p>
            </div>
            <span className="badge" style={{ marginLeft: 'auto', flexShrink: 0 }}>{fr.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
