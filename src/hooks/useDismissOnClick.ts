import { useEffect, useRef } from 'react';

/**
 * App-wide rule for transient success / error messages (banners, toasts, inline notices):
 * while one is showing, the next press anywhere on screen hides it.
 *
 *   const [msg, setMsg] = useState<string | null>(null);
 *   useDismissOnClick(!!msg, () => setMsg(null));
 *
 * The listener runs in the capture phase, so it still fires when the clicked element stops
 * propagation (modals, menus). It is armed one tick after the message appears, so the click
 * that produced the message never hides it straight away.
 */
export function useDismissOnClick(showing: boolean, dismiss: () => void): void {
  const dismissRef = useRef(dismiss);
  dismissRef.current = dismiss;

  useEffect(() => {
    if (!showing) return;
    let armed = false;
    const arm = window.setTimeout(() => { armed = true; }, 0);
    const onDown = () => { if (armed) dismissRef.current(); };
    document.addEventListener('pointerdown', onDown, true);
    return () => {
      window.clearTimeout(arm);
      document.removeEventListener('pointerdown', onDown, true);
    };
  }, [showing]);
}
