'use client';

import { type ChangeEvent, type DragEvent } from 'react';
import { getSafeImageUrl } from '@/lib/asset-safety';

export type VisualDropKind = 'image' | 'link' | 'text';

export type VisualDropStudioSlot<TSlotId extends string> = {
  id: TSlotId;
  label: string;
  description: string;
  kind: VisualDropKind;
  value: string;
  accept?: string;
  maxSizeMb?: number;
  placeholder?: string;
};

type VisualDropStudioProps<TSlotId extends string> = {
  title?: string;
  description?: string;
  slots: VisualDropStudioSlot<TSlotId>[];
  onChange: (slotId: TSlotId, value: string) => void;
  onStatus?: (message: string) => void;
};

const slotTransferKey = 'application/x-ihype-visual-slot';

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

function getExpectedPrefix(kind: VisualDropKind) {
  if (kind === 'image') return 'image/';
  return '';
}

function getDefaultMaxSizeMb() {
  return 4;
}

function canUseTextDrop(kind: VisualDropKind, value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (kind === 'link' || kind === 'text') return true;
  if (kind === 'image') return Boolean(getSafeImageUrl(trimmed));
  return false;
}

function canMoveBetweenSlots(fromKind: VisualDropKind, toKind: VisualDropKind) {
  if (fromKind === toKind) return true;
  return (fromKind === 'link' && toKind === 'text') || (fromKind === 'text' && toKind === 'link');
}

function getSlotPreview(slot: VisualDropStudioSlot<string>) {
  if (!slot.value) {
    return (
      <span className="visual-drop-empty">
        {slot.placeholder ?? (slot.kind === 'image' ? 'Drop image' : 'Drop link')}
      </span>
    );
  }

  if (slot.kind === 'image') {
    const safeImage = getSafeImageUrl(slot.value);
    return safeImage ? <img alt="" src={safeImage} /> : <span className="visual-drop-empty">Image pending</span>;
  }

  return <span className="visual-drop-link-preview">{slot.value}</span>;
}

export function VisualDropStudio<TSlotId extends string>({
  title = 'Drag and drop design board',
  description = 'Drop files, paste links, or move loaded assets between slots to place them on the page.',
  slots,
  onChange,
  onStatus
}: VisualDropStudioProps<TSlotId>) {
  async function applyFileToSlot(slot: VisualDropStudioSlot<TSlotId>, file: File) {
    const expectedPrefix = getExpectedPrefix(slot.kind);
    const maxSizeMb = slot.maxSizeMb ?? getDefaultMaxSizeMb();

    if (!expectedPrefix) {
      onStatus?.('Drop an image, video, or URL onto a matching visual slot.');
      return;
    }

    if (!file.type.startsWith(expectedPrefix)) {
      onStatus?.(`Drop a ${slot.kind} file onto ${slot.label}.`);
      return;
    }

    if (file.size > maxSizeMb * 1024 * 1024) {
      onStatus?.(`${slot.label} is capped at ${maxSizeMb}MB.`);
      return;
    }

    const dataUrl = await readFileAsDataUrl(file);
    onChange(slot.id, dataUrl);
    onStatus?.(`${file.name} placed in ${slot.label}.`);
  }

  async function handleDrop(event: DragEvent<HTMLDivElement>, slot: VisualDropStudioSlot<TSlotId>) {
    event.preventDefault();
    event.currentTarget.classList.remove('is-dragging');

    const transferSlotId = event.dataTransfer.getData(slotTransferKey) as TSlotId | '';
    const sourceSlot = transferSlotId ? slots.find((candidate) => candidate.id === transferSlotId) : null;

    if (sourceSlot && sourceSlot.id !== slot.id) {
      if (!sourceSlot.value) {
        onStatus?.(`${sourceSlot.label} is empty.`);
        return;
      }

      if (!canMoveBetweenSlots(sourceSlot.kind, slot.kind)) {
        onStatus?.(`${sourceSlot.label} cannot move into ${slot.label}.`);
        return;
      }

      onChange(slot.id, sourceSlot.value);
      onChange(sourceSlot.id, '');
      onStatus?.(`${sourceSlot.label} moved to ${slot.label}.`);
      return;
    }

    const file = event.dataTransfer.files?.[0];
    if (file) {
      try {
        await applyFileToSlot(slot, file);
      } catch {
        onStatus?.(`Could not load ${file.name}.`);
      }
      return;
    }

    const droppedText =
      event.dataTransfer.getData('text/uri-list') || event.dataTransfer.getData('text/plain');

    if (canUseTextDrop(slot.kind, droppedText)) {
      onChange(slot.id, droppedText.trim());
      onStatus?.(`Dropped content placed in ${slot.label}.`);
      return;
    }

    onStatus?.(`Drop a valid ${slot.kind === 'text' ? 'note' : slot.kind} onto ${slot.label}.`);
  }

  async function handleFileInput(event: ChangeEvent<HTMLInputElement>, slot: VisualDropStudioSlot<TSlotId>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await applyFileToSlot(slot, file);
    } catch {
      onStatus?.(`Could not load ${file.name}.`);
    } finally {
      event.target.value = '';
    }
  }

  return (
    <div className="visual-drop-studio">
      <div className="visual-drop-studio-head">
        <div>
          <strong>{title}</strong>
          <p className="meta">{description}</p>
        </div>
        <span className="visual-drop-helper">Desktop drop + phone upload</span>
      </div>

      <div className="visual-drop-grid">
        {slots.map((slot) => (
          <div
            aria-label={`${slot.label}: ${slot.description}`}
            className={slot.value ? 'visual-drop-slot has-asset' : 'visual-drop-slot'}
            draggable={Boolean(slot.value)}
            key={slot.id}
            onDragEnd={(event) => event.currentTarget.classList.remove('is-dragging')}
            onDragEnter={(event) => {
              event.preventDefault();
              event.currentTarget.classList.add('is-dragging');
            }}
            onDragLeave={(event) => event.currentTarget.classList.remove('is-dragging')}
            onDragOver={(event) => event.preventDefault()}
            onDragStart={(event) => {
              event.dataTransfer.setData(slotTransferKey, slot.id);
              event.dataTransfer.effectAllowed = 'move';
            }}
            onDrop={(event) => void handleDrop(event, slot)}
            role="group"
          >
            <span className="visual-drop-preview">{getSlotPreview(slot)}</span>
            <span className="visual-drop-slot-copy">
              <strong>{slot.label}</strong>
              <small>{slot.description}</small>
            </span>
            <span className="visual-drop-slot-footer">
              {slot.kind === 'image' ? (
                <label className="visual-drop-slot-action visual-drop-browse">
                  {slot.value ? 'Replace' : 'Upload'}
                  <input
                    accept={slot.accept ?? 'image/*'}
                    onChange={(event) => void handleFileInput(event, slot)}
                    type="file"
                  />
                </label>
              ) : (
                <span className="visual-drop-slot-action">Drop URL/text</span>
              )}
              {slot.value ? (
                <button
                  className="visual-drop-clear"
                  onClick={() => {
                    onChange(slot.id, '');
                    onStatus?.(`${slot.label} cleared.`);
                  }}
                  type="button"
                >
                  Clear
                </button>
              ) : null}
            </span>
            {slot.kind === 'image' ? (
              <span className="visual-drop-slot-action visual-drop-move-hint">
                {slot.value ? 'Drag card to move' : 'Drop file here'}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
