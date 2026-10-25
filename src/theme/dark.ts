/**
 * Dark theme — a direct port of the design's colour transform
 * (docs/design/Fusion Close.dc.html, dkHsl/dkRgb/dkOne/dkStr/dkStyle at
 * lines 4866–4928, and dkPatch at 4929).
 *
 * It is not an invert filter. Each colour is converted to HSL and remapped by
 * rule: light neutrals flip to dark neutrals keeping their hue, saturated
 * mid-tones are lifted to stay legible, translucent overlays become white or
 * black washes, and pure white becomes near-black (or near-white for text).
 *
 * The design applies this by patching React.createElement so every inline
 * `style` object passes through it. This project compiles JSX with the classic
 * runtime for exactly that reason (see vite.config.ts / tsconfig.app.json).
 */

type RGB = [number, number, number];

function toHsl(r: number, g: number, b: number): RGB {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  let h = 0;
  let s = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return [h, s * 100, l * 100];
}

function toRgb(h: number, s: number, l: number): RGB {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return [f(0), f(8), f(4)];
}

/** Map a single colour token. `fg` marks foreground properties (colour, fill, stroke…). */
export function darkColor(tok: string, fg: boolean): string {
  let r: number;
  let g: number;
  let b: number;
  let a = 1;

  if (tok.charAt(0) === '#') {
    let x = tok.slice(1);
    if (x.length === 3) x = x[0] + x[0] + x[1] + x[1] + x[2] + x[2];
    if (x.length === 8) { a = parseInt(x.slice(6, 8), 16) / 255; x = x.slice(0, 6); }
    if (x.length !== 6) return tok;
    r = parseInt(x.slice(0, 2), 16);
    g = parseInt(x.slice(2, 4), 16);
    b = parseInt(x.slice(4, 6), 16);
  } else {
    const m = tok.match(/[\d.]+/g);
    if (!m || m.length < 3) return tok;
    r = +m[0]; g = +m[1]; b = +m[2];
    a = m.length > 3 ? +m[3] : 1;
  }

  const [h, s, l] = toHsl(r, g, b);

  // translucent overlays become a white or black wash rather than a colour
  if (a < 1) {
    if (l > 78 && s < 40) return `rgba(255,255,255,${(Math.min(a, 1) * 0.16).toFixed(3)})`;
    if (l < 34 && s < 34) return `rgba(0,0,0,${Math.min(a * 1.5, 0.72).toFixed(3)})`;
    return tok;
  }

  if (r === 255 && g === 255 && b === 255) return fg ? '#EEF2FA' : '#171B23';

  let ns = s;
  let nl = l;
  if (!fg && s < 45 && l < 38) { nl = 8 + l * 0.42; ns = Math.min(s, 22); }
  else if (s < 45 || l >= 80) { nl = 6 + (100 - l) * 0.88; ns = s < 45 ? Math.min(s, 26) : s * 0.5; }
  else if (l < 46) { nl = 62; }

  const [nr, ng, nb] = toRgb(h, ns, nl);
  return `rgb(${nr},${ng},${nb})`;
}

const cache: Record<string, string> = {};

/** Map every colour token inside a CSS value (gradients, shadows, borders…). */
export function darkValue(v: string, fg: boolean): string {
  const key = (fg ? 'f|' : 'b|') + v;
  const hit = cache[key];
  if (hit !== undefined) return hit;
  const out = v.replace(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g, (m) => darkColor(m, fg));
  cache[key] = out;
  return out;
}

const FG_PROPS: Record<string, 1> = {
  color: 1, fill: 1, stroke: 1, caretColor: 1, accentColor: 1,
  WebkitTextFillColor: 1, textDecorationColor: 1,
};

export function darkStyle(st: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k in st) {
    const v = st[k];
    out[k] = typeof v === 'string' && (v.indexOf('#') > -1 || v.indexOf('rgb') > -1)
      ? darkValue(v, !!FG_PROPS[k])
      : v;
  }
  return out;
}

/**
 * Patch React.createElement so every element's inline style is remapped while
 * dark mode is on. Mirrors the design's dkPatch (line 4929).
 */
export function installDarkTheme(React: {
  createElement: (...args: unknown[]) => unknown;
}, isDark: () => boolean) {
  const orig = React.createElement;
  if ((orig as { __fcDark?: boolean }).__fcDark) return;

  const patched = function (this: unknown, type: unknown, props: unknown, ...rest: unknown[]) {
    if (isDark() && props && typeof props === 'object') {
      const p = props as { style?: unknown };
      if (p.style && typeof p.style === 'object' && !Array.isArray(p.style)) {
        return orig.apply(this, [
          type,
          { ...(p as object), style: darkStyle(p.style as Record<string, unknown>) },
          ...rest,
        ]);
      }
    }
    return orig.apply(this, [type, props, ...rest]);
  };
  (patched as { __fcDark?: boolean }).__fcDark = true;
  React.createElement = patched as typeof React.createElement;
}
