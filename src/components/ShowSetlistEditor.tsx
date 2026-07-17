'use client';

import { useState } from 'react';

type SetlistTemplate = { id: string; name: string; tracks: unknown };

export function ShowSetlistEditor({
  showId,
  profileId,
  initialTracks
}: {
  showId: string;
  profileId?: string;
  initialTracks: string[];
}) {
  const [text, setText] = useState(initialTracks.join('\n'));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [templates, setTemplates] = useState<SetlistTemplate[] | null>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editTracksText, setEditTracksText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    const tracks = text.split('\n').map((s) => s.trim()).filter(Boolean);
    const res = await fetch(`/api/shows/${showId}/setlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tracks })
    });
    if (res.ok) setMsg('Saved.');
    else setMsg('Could not save.');
    setBusy(false);
  }

  async function loadTemplates() {
    if (!profileId) return;
    setLoadingTemplates(true);
    try {
      const res = await fetch(`/api/setlist-templates?profileId=${profileId}`);
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates ?? []);
        setShowTemplates(true);
      }
    } catch {
      // ignore
    } finally {
      setLoadingTemplates(false);
    }
  }

  function applyTemplate(template: SetlistTemplate) {
    const tracks = Array.isArray(template.tracks)
      ? (template.tracks as string[]).join('\n')
      : typeof template.tracks === 'string'
      ? template.tracks
      : '';
    setText(tracks);
    setShowTemplates(false);
    setMsg(`Loaded template "${template.name}".`);
  }

  function templateTracksToText(template: SetlistTemplate) {
    return Array.isArray(template.tracks)
      ? (template.tracks as string[]).join('\n')
      : typeof template.tracks === 'string'
      ? template.tracks
      : '';
  }

  async function createTemplate() {
    if (!profileId || !newTemplateName.trim()) return;
    setSavingTemplate(true);
    setMsg(null);
    const tracks = text.split('\n').map((s) => s.trim()).filter(Boolean);
    try {
      const res = await fetch('/api/setlist-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, name: newTemplateName.trim(), tracks })
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.template) {
        setTemplates((current) => [data.template, ...(current ?? [])]);
        setNewTemplateName('');
        setMsg(`Saved template "${data.template.name}".`);
      } else {
        setMsg(data?.error ?? 'Could not save template.');
      }
    } catch {
      setMsg('Could not save template.');
    } finally {
      setSavingTemplate(false);
    }
  }

  function startEditTemplate(template: SetlistTemplate) {
    setEditingTemplateId(template.id);
    setEditName(template.name);
    setEditTracksText(templateTracksToText(template));
    setMsg(null);
  }

  function cancelEditTemplate() {
    setEditingTemplateId(null);
    setEditName('');
    setEditTracksText('');
  }

  async function saveEditTemplate() {
    if (!editingTemplateId || !editName.trim()) return;
    setSavingEdit(true);
    setMsg(null);
    const tracks = editTracksText.split('\n').map((s) => s.trim()).filter(Boolean);
    try {
      const res = await fetch(`/api/setlist-templates/${editingTemplateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), tracks })
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.template) {
        const savedId = editingTemplateId;
        setTemplates((current) => (current ?? []).map((t) => (t.id === savedId ? data.template : t)));
        setMsg(`Updated template "${data.template.name}".`);
        cancelEditTemplate();
      } else {
        setMsg(data?.error ?? 'Could not update template.');
      }
    } catch {
      setMsg('Could not update template.');
    } finally {
      setSavingEdit(false);
    }
  }

  async function deleteTemplate(id: string) {
    if (typeof window !== 'undefined' && !window.confirm('Delete this template?')) return;
    setDeletingTemplateId(id);
    setMsg(null);
    try {
      const res = await fetch(`/api/setlist-templates/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setTemplates((current) => (current ?? []).filter((t) => t.id !== id));
        if (editingTemplateId === id) cancelEditTemplate();
        setMsg('Template deleted.');
      } else {
        const data = await res.json().catch(() => null);
        setMsg(data?.error ?? 'Could not delete template.');
      }
    } catch {
      setMsg('Could not delete template.');
    } finally {
      setDeletingTemplateId(null);
    }
  }

  return (
    <section className="section">
      <h2>Setlist (owner only)</h2>
      {profileId ? (
        <div style={{ marginBottom: 8 }}>
          <button
            className="button small secondary"
            onClick={showTemplates ? () => setShowTemplates(false) : loadTemplates}
            disabled={loadingTemplates}
            type="button"
          >
            {loadingTemplates ? 'Loading...' : showTemplates ? 'Hide templates' : 'Load template'}
          </button>
          {showTemplates && templates !== null ? (
            <div style={{ marginTop: 8, background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 8, padding: 8 }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <input
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="New template name…"
                  type="text"
                  style={{
                    flex: 1,
                    padding: '6px 8px',
                    borderRadius: 6,
                    background: 'var(--bg-2)',
                    border: '1px solid var(--line)',
                    color: 'var(--ink)',
                    fontFamily: 'var(--f-b)',
                    fontSize: 12
                  }}
                />
                <button
                  className="button small secondary"
                  onClick={createTemplate}
                  disabled={savingTemplate || !newTemplateName.trim()}
                  type="button"
                >
                  {savingTemplate ? 'Saving…' : 'Save current as template'}
                </button>
              </div>
              {templates.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: 0 }}>No templates saved yet.</p>
              ) : (
                templates.map((t) =>
                  editingTemplateId === t.id ? (
                    <div
                      key={t.id}
                      style={{ marginBottom: 8, padding: 8, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6 }}
                    >
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        type="text"
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          borderRadius: 6,
                          background: 'var(--bg-3)',
                          border: '1px solid var(--line)',
                          color: 'var(--ink)',
                          fontFamily: 'var(--f-b)',
                          fontSize: 12,
                          marginBottom: 6
                        }}
                      />
                      <textarea
                        value={editTracksText}
                        onChange={(e) => setEditTracksText(e.target.value)}
                        rows={5}
                        placeholder="One track per line…"
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          borderRadius: 6,
                          background: 'var(--bg-3)',
                          border: '1px solid var(--line)',
                          color: 'var(--ink)',
                          fontFamily: 'var(--f-b)',
                          fontSize: 12,
                          marginBottom: 6
                        }}
                      />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="button small"
                          onClick={saveEditTemplate}
                          disabled={savingEdit || !editName.trim()}
                          type="button"
                        >
                          {savingEdit ? 'Saving…' : 'Save changes'}
                        </button>
                        <button className="button small secondary" onClick={cancelEditTemplate} disabled={savingEdit} type="button">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={t.id}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, marginRight: 6, marginBottom: 4 }}
                    >
                      <button className="button small secondary" onClick={() => applyTemplate(t)} type="button">
                        {t.name}
                      </button>
                      <button className="button small secondary" onClick={() => startEditTemplate(t)} type="button">
                        Edit
                      </button>
                      <button
                        className="button small secondary"
                        onClick={() => deleteTemplate(t.id)}
                        disabled={deletingTemplateId === t.id}
                        type="button"
                      >
                        {deletingTemplateId === t.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  )
                )
              )}
            </div>
          ) : null}
        </div>
      ) : null}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        placeholder="One track per line…"
        style={{
          width: '100%',
          padding: '10px 12px',
          borderRadius: 8,
          background: 'var(--bg-3)',
          border: '1px solid var(--line)',
          color: 'var(--ink)',
          fontFamily: 'var(--f-b)'
        }}
      />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
        <button className="button small" onClick={save} disabled={busy} type="button">
          {busy ? 'Saving…' : 'Save setlist'}
        </button>
        {msg ? <span className="meta">{msg}</span> : null}
      </div>
    </section>
  );
}
