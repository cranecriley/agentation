// =============================================================================
// Agentation
// =============================================================================
//
// A floating toolbar for annotating web pages and collecting structured feedback
// for AI coding agents.
//
// Usage:
//   import { Agentation } from 'agentation';
//   <Agentation />
//
// =============================================================================

// Main components
// CSS-only version (default - zero runtime deps)
export { PageFeedbackToolbarCSS as Agentation } from "./components/page-toolbar-css";
export { PageFeedbackToolbarCSS } from "./components/page-toolbar-css";
export type { DemoAnnotation, AgentationProps } from "./components/page-toolbar-css";

// Shared components (for building custom UIs)
export { AnnotationPopupCSS } from "./components/annotation-popup-css";
export type {
  AnnotationPopupCSSProps,
  AnnotationPopupCSSHandle,
} from "./components/annotation-popup-css";

// Mock overlay (design mockup over live page)
export { MockOverlay, resolveMockUrl, useCurrentPathname } from "./components/mock-overlay";
export type { MockupsConfig, MockupRoutes } from "./components/mock-overlay";

// Token re-roll (live design-token exploration)
export { RerollPanel, randomRecipe, describeRecipe, applyRecipe, clearOverrides, collectRootTokens, parseColor, parseSimpleColor, applyRecipeToColor, hslaToCss } from "./components/reroll";
export type { RerollConfig, RerollRecipe } from "./components/reroll";

// Icons (same for both versions - they're pure SVG)
export * from "./components/icons";

// Utilities (for building custom UIs)
export {
  identifyElement,
  identifyAnimationElement,
  getElementPath,
  getNearbyText,
  getElementClasses,
  // Shadow DOM support
  isInShadowDOM,
  getShadowHost,
  closestCrossingShadow,
} from "./utils/element-identification";

export {
  loadAnnotations,
  saveAnnotations,
  getStorageKey,
} from "./utils/storage";

// Types
export type { Annotation } from "./types";
