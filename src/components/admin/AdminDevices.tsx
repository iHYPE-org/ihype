'use client';

import { useCallback, useEffect, useState } from 'react';

type Device = {
  id: string;
  label: string | null;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
};

/**
 * The devices allowed to open the console.
 *
 * Until 2026-08-14 there was exactly one — `User.adminDeviceTokenHash` was a
 * single column — so there was nothing to list and no way to revoke except by
 * overwriting it. Now that devices are rows, "which machines can open this"
 * is a real question with a real answer, and an operations console that cannot
 * answer it about itself is the wrong place to run an organisation from.
 *
 * Deliberately plain: it reads once on mount rather than polling. This changes
 * when someone registers a device, which is rare and always something the
 * operator just did — spending a poll on it would be spending it on nothing.
 */
export function AdminDevices() {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/devices', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as { devices: Device[] };
      setDevices(data.devices);
      setError(null);
    } catch (e) {
      // null stays null, so the panel says it could not read rather than
      // showing an empty list — which would claim no devices are registered,
      // and that claim would be alarming and wrong.
      setError(e instanceof Error ? e.message : 'could not read devices');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function revoke(device: Device) {
    const confirmed = device.current
      ? window.confirm(
          'This is the device you are using. Revoking it signs this device out of the console, and getting back in needs a new registration link by email. Continue?',
        )
      : window.confirm(`Revoke ${device.label ?? 'this device'}? It will need a new registration link to open the console again.`);
    if (!confirmed) return;

    setBusy(device.id);
    try {
      const query = new URLSearchParams({ id: device.id });
      if (device.current) query.set('confirmSelf', 'true');
      const response = await fetch(`/api/admin/devices?${query}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'revoke failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="panel admin-console-panel">
      <div className="admin-console-panel-head">
        <h2>Admin devices</h2>
      </div>
      <p className="meta" style={{ marginTop: 0 }}>
        Every device that can open this console. Registering a new one no longer signs the others out.
      </p>

      {error && <p className="meta" style={{ color: 'var(--warning-text)' }}>Could not read devices — {error}</p>}
      {!error && devices === null && <p className="meta">Reading…</p>}
      {!error && devices?.length === 0 && (
        <p className="meta">
          No devices registered. That should be impossible while you are reading this, so it is worth
          investigating rather than ignoring.
        </p>
      )}

      {devices && devices.length > 0 && (
        <ul className="admin-list">
          {devices.map((device) => (
            <li className="admin-list-row" key={device.id}>
              <div style={{ minWidth: 0 }}>
                <div>
                  {device.label ?? 'Unknown device'}
                  {device.current && <span className="badge" style={{ marginLeft: 8 }}>This device</span>}
                </div>
                <div className="meta">
                  Last used {new Date(device.lastSeenAt).toLocaleString()} · registered{' '}
                  {new Date(device.createdAt).toLocaleDateString()}
                </div>
              </div>
              <button
                className="button secondary small"
                disabled={busy === device.id}
                onClick={() => void revoke(device)}
                type="button"
              >
                {busy === device.id ? 'Revoking…' : 'Revoke'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
