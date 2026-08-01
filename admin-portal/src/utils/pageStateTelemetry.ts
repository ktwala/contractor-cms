/**
 * Page-state telemetry — lightweight analytics for classified page states.
 *
 * All track* helpers are no-op safe: they silently swallow errors and do
 * nothing if no analytics sink is registered.  Wire a real provider (e.g.
 * PostHog, Segment, custom API) via `setPageStateTelemetrySink()`.
 */

import { useRef, useEffect } from 'react';
import type { PageState } from './pageState';

// ─── Event types ─────────────────────────────────────────────────

export interface PageStateRenderedEvent {
  page: string;
  module: string;
  state: 'loading' | 'error' | 'blocked' | 'empty' | 'ready';
  blockedCode?: string;
  errorCode?: string;
  httpStatus?: number;
  retryable?: boolean;
}

export interface PageStateRetryClickedEvent {
  page: string;
  module: string;
  errorCode?: string;
  httpStatus?: number;
}

export interface PageStateCtaClickedEvent {
  page: string;
  module: string;
  state: 'blocked' | 'empty';
  code?: string;
  ctaTarget?: string;
  ctaLabel?: string;
}

// ─── Sink ────────────────────────────────────────────────────────

export interface PageStateTelemetrySink {
  track(event: string, payload: Record<string, unknown>): void;
}

let sink: PageStateTelemetrySink | null = null;

export function setPageStateTelemetrySink(s: PageStateTelemetrySink): void {
  sink = s;
}

function emit(event: string, payload: Record<string, unknown>): void {
  try {
    sink?.track(event, payload);
  } catch {
    // no-op — telemetry must never break the UI
  }
}

// ─── Track helpers ───────────────────────────────────────────────

export function trackPageStateRendered(input: PageStateRenderedEvent): void {
  emit('page_state_rendered', input as unknown as Record<string, unknown>);
}

export function trackPageStateRetryClicked(input: PageStateRetryClickedEvent): void {
  emit('page_state_retry_clicked', input as unknown as Record<string, unknown>);
}

export function trackPageStateCtaClicked(input: PageStateCtaClickedEvent): void {
  emit('page_state_cta_clicked', input as unknown as Record<string, unknown>);
}

// ─── Convenience: build rendered-event from a PageState ──────────

export function buildRenderedEvent(
  page: string,
  module: string,
  state: PageState,
): PageStateRenderedEvent {
  const base: PageStateRenderedEvent = { page, module, state: state.kind };
  switch (state.kind) {
    case 'blocked':
      base.blockedCode = state.code;
      break;
    case 'error':
      base.errorCode = state.code;
      base.httpStatus = state.status;
      base.retryable = state.retryable;
      break;
  }
  return base;
}

// ─── React hook: fires once per state transition (deduped) ───────

/**
 * Tracks page_state_rendered exactly once per state *transition*.
 * Uses a ref to compare against the previous kind + code, suppressing
 * duplicate events on re-renders that don't change state.
 */
export function usePageStateTelemetry(
  page: string,
  module: string,
  state: PageState,
): void {
  const prev = useRef<string>('');

  useEffect(() => {
    const key = stateKey(state);
    if (key === prev.current) return;
    prev.current = key;
    trackPageStateRendered(buildRenderedEvent(page, module, state));
  }, [page, module, state]);
}

function stateKey(s: PageState): string {
  switch (s.kind) {
    case 'blocked': return `blocked:${s.code}`;
    case 'error':   return `error:${s.code ?? ''}:${s.status ?? ''}`;
    default:        return s.kind;
  }
}
