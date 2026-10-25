import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * React port of the design's <image-slot> web component
 * (docs/design/image-slot.js) — a user-fillable image placeholder.
 *
 * Behaviour kept from the original:
 *  - click an empty slot to browse for a file
 *  - drag & drop an image onto it (dashed ring turns #c96442 while over)
 *  - the slot keeps its image across reloads, keyed by `id`
 *  - hover controls to Replace or Remove once filled
 *
 * The original persists through the omelette runtime's sidecar JSON file.
 * There is no backend here, so this stores a data URL in localStorage under
 * `fc.imageslot.<id>`. Swap `load`/`save` for an upload endpoint later.
 */

const KEY = (id: string) => `fc.imageslot.${id}`;

function load(id: string): string | null {
  try {
    return localStorage.getItem(KEY(id));
  } catch {
    return null;
  }
}

function save(id: string, value: string | null) {
  try {
    if (value) localStorage.setItem(KEY(id), value);
    else localStorage.removeItem(KEY(id));
  } catch {
    /* private mode / blocked storage — the slot still works for this session */
  }
}

type Props = {
  id: string;
  placeholder?: string;
  /** object-fit for the filled image. 'contain' for logos, 'cover' for heroes. */
  fit?: 'contain' | 'cover';
  radius?: string;
  style?: React.CSSProperties;
};

export default function ImageSlot({
  id,
  placeholder = 'Drop an image',
  fit = 'contain',
  radius,
  style,
}: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [hover, setHover] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setSrc(load(id)), [id]);

  const accept = useCallback(
    (file: File | undefined) => {
      if (!file || !file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => {
        const url = String(reader.result);
        setSrc(url);
        save(id, url);
      };
      reader.readAsDataURL(file);
    },
    [id],
  );

  const browse = () => inputRef.current?.click();

  const remove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSrc(null);
    save(id, null);
  };

  return (
    <div
      onClick={browse}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        accept(e.dataTransfer.files?.[0]);
      }}
      title={src ? 'Click to replace' : placeholder}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        cursor: 'pointer',
        borderRadius: radius,
        ...style,
      }}
    >
      {src ? (
        <img
          src={src}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: fit, display: 'block' }}
        />
      ) : (
        <span
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            textAlign: 'center',
            padding: '12px',
            boxSizing: 'border-box',
            fontSize: '10px',
            fontStyle: 'italic',
            lineHeight: 1.3,
            color: '#9AA3BA',
          }}
        >
          <svg
            width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
          >
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M3 16l5-5 4 4 3-3 6 6" />
            <circle cx="9" cy="9" r="1.4" />
          </svg>
          {placeholder}
        </span>
      )}

      {/* dashed drop ring — design: 1.5px dashed rgba(0,0,0,.25), #c96442 while over */}
      {!src && (
        <span
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            border: `1.5px dashed ${over ? '#c96442' : 'rgba(0,0,0,.25)'}`,
            borderRadius: 'inherit',
            transition: 'border-color .12s',
          }}
        />
      )}

      {/* Replace / Remove, revealed on hover once filled */}
      {src && hover && (
        <span
          style={{
            position: 'absolute',
            top: '6px',
            right: '6px',
            display: 'flex',
            gap: '4px',
          }}
        >
          <button
            type="button"
            className="fc-btn"
            onClick={(e) => {
              e.stopPropagation();
              browse();
            }}
            style={{
              borderRadius: '6px',
              padding: '4px 8px',
              fontSize: '9.5px',
              fontWeight: 700,
              color: '#232C42',
              background: 'rgba(255,255,255,.85)',
              backdropFilter: 'blur(6px)',
            }}
          >
            Replace
          </button>
          <button
            type="button"
            className="fc-btn"
            onClick={remove}
            style={{
              borderRadius: '6px',
              padding: '4px 8px',
              fontSize: '9.5px',
              fontWeight: 700,
              color: '#B42318',
              background: 'rgba(255,255,255,.85)',
              backdropFilter: 'blur(6px)',
            }}
          >
            Remove
          </button>
        </span>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          accept(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}
