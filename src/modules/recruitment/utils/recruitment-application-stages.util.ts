/**
 * Normalizes stage filter tokens from API/query params to Prisma `job_applications.stage` values.
 */
export function normalizeRecruitmentApplicationStages(stageParam?: string): string[] | undefined {
  if (!stageParam?.trim()) return undefined;
  const map: Record<string, string> = {
    SCREENING: 'phone_screen',
    INTERVIEW: 'interview',
    OFFER: 'offer',
    APPLIED: 'applied',
    FINAL: 'final',
    applied: 'applied',
    phone_screen: 'phone_screen',
    interview: 'interview',
    offer: 'offer',
    final: 'final',
  };
  const out = new Set<string>();
  for (const part of stageParam.split(',')) {
    const t = part.trim();
    if (!t) continue;
    out.add(map[t] ?? t.toLowerCase());
  }
  return out.size ? [...out] : undefined;
}
