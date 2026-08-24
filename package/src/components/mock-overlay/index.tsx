// =============================================================================
// Mock Overlay
// =============================================================================
//
// Renders a design mockup image over the live page so drift between the
// shipped UI and the design is visible at a glance. The overlay scrolls with
// the document (mocks are full-page captures), ignores pointer events, and
// exposes a small control panel for opacity and sizing.
//
// Usage (via the Agentation toolbar):
//   <Agentation mockups={{ routes: { "/home": "/mocks/home.png" } }} />
//
// =============================================================================

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./styles.module.scss";

export type MockupRoutes = Record<string, string>;

export type MockupsConfig = {
  /**
   * Map of pathname -> mock image URL, or a resolver function returning the
   * URL for a pathname (null/undefined when the route has no mock).
   */
  routes: MockupRoutes | ((pathname: string) => string | null | undefined);
  /** Initial overlay opacity, 0..1. Defaults to 0.5. */
  defaultOpacity?: number;
};

/** Resolve the mock image URL for a pathname, tolerating trailing slashes. */
export function resolveMockUrl(
  config: MockupsConfig | undefined,
  pathname: string,
): string | null {
  if (!config) return null;
  if (typeof config.routes === "function") {
    return config.routes(pathname) ?? null;
  }
  const normalized =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;
  return config.routes[normalized] ?? config.routes[`${normalized}/`] ?? null;
}

// -----------------------------------------------------------------------------
// Pathname tracking
// -----------------------------------------------------------------------------

const NAVIGATION_EVENT = "agentation:navigation";
let historyPatched = false;

/** Patch pushState/replaceState once so client-side navigations are observable. */
function patchHistory() {
  if (historyPatched || typeof window === "undefined") return;
  historyPatched = true;
  for (const method of ["pushState", "replaceState"] as const) {
    const original = window.history[method].bind(window.history);
    window.history[method] = (...args: Parameters<History["pushState"]>) => {
      const result = original(...args);
      window.dispatchEvent(new Event(NAVIGATION_EVENT));
      return result;
    };
  }
}

/** Current pathname, kept in sync across SPA navigations. */
export function useCurrentPathname(): string {
  const [pathname, setPathname] = useState(() =>
    typeof window === "undefined" ? "/" : window.location.pathname,
  );

  useEffect(() => {
    patchHistory();
    const update = () => setPathname(window.location.pathname);
    window.addEventListener(NAVIGATION_EVENT, update);
    window.addEventListener("popstate", update);
    return () => {
      window.removeEventListener(NAVIGATION_EVENT, update);
      window.removeEventListener("popstate", update);
    };
  }, []);

  return pathname;
}

// -----------------------------------------------------------------------------
// Overlay
// -----------------------------------------------------------------------------

export type MockOverlayProps = {
  url: string;
  opacity: number;
  onOpacityChange: (opacity: number) => void;
  /** When true the mock is scaled to the viewport width; otherwise 1:1 pixels. */
  fitWidth: boolean;
  onFitWidthChange: (fitWidth: boolean) => void;
  onClose: () => void;
};

export function MockOverlay({
  url,
  opacity,
  onOpacityChange,
  fitWidth,
  onFitWidthChange,
  onClose,
}: MockOverlayProps) {
  const [naturalWidth, setNaturalWidth] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    setNaturalWidth(null);
  }, [url]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      {!failed && (
        <div className={styles.overlay} data-agentation-mock-overlay>
          <img
            className={styles.overlayImage}
            src={url}
            alt=""
            aria-hidden="true"
            style={{
              opacity,
              width: fitWidth ? "100%" : (naturalWidth ?? undefined),
            }}
            onLoad={(e) => setNaturalWidth(e.currentTarget.naturalWidth)}
            onError={() => setFailed(true)}
          />
        </div>
      )}
      <div className={styles.panel} data-agentation-mock-panel>
        <span className={styles.panelLabel}>Mock</span>
        {failed ? (
          <span className={styles.panelError}>image failed to load</span>
        ) : (
          <>
            <input
              className={styles.panelSlider}
              type="range"
              min={0}
              max={100}
              value={Math.round(opacity * 100)}
              onChange={(e) => onOpacityChange(Number(e.target.value) / 100)}
              aria-label="Mock overlay opacity"
            />
            <span className={styles.panelValue}>
              {Math.round(opacity * 100)}%
            </span>
            <button
              className={styles.panelToggle}
              data-active={!fitWidth}
              onClick={() => onFitWidthChange(!fitWidth)}
              title={
                fitWidth
                  ? "Switch to 1:1 pixel size"
                  : `Fit viewport width${naturalWidth ? ` (mock is ${naturalWidth}px)` : ""}`
              }
            >
              {fitWidth ? "fit" : "1:1"}
            </button>
          </>
        )}
        <button
          className={styles.panelClose}
          onClick={onClose}
          aria-label="Hide mock overlay"
        >
          &times;
        </button>
      </div>
    </>,
    document.body,
  );
}
