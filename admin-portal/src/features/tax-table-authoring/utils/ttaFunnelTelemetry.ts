type FunnelStage =
  | 'template_selected'
  | 'draft_created'
  | 'validation_passed'
  | 'published';

interface FunnelEvent {
  stage: FunnelStage;
  countryCode?: string;
  tableType?: string;
  taxYear?: string;
  method?: string;
  templateCode?: string;
  draftId?: string;
  bracketChanges?: number;
  fieldChanges?: number;
}

export function trackTtaFunnel(event: FunnelEvent): void {
  try {
    window.dispatchEvent(new CustomEvent('tta:funnel', { detail: event }));
  } catch { /* no-op */ }
}
