import { normalizeRecruitmentApplicationStages } from './recruitment-application-stages.util';

describe('normalizeRecruitmentApplicationStages', () => {
  it('returns undefined for empty input', () => {
    expect(normalizeRecruitmentApplicationStages(undefined)).toBeUndefined();
    expect(normalizeRecruitmentApplicationStages('')).toBeUndefined();
    expect(normalizeRecruitmentApplicationStages('   ')).toBeUndefined();
  });

  it('maps uppercase aliases to prisma stage values', () => {
    expect(normalizeRecruitmentApplicationStages('SCREENING')).toEqual(['phone_screen']);
    expect(normalizeRecruitmentApplicationStages('INTERVIEW')).toEqual(['interview']);
    expect(normalizeRecruitmentApplicationStages('OFFER')).toEqual(['offer']);
    expect(normalizeRecruitmentApplicationStages('APPLIED')).toEqual(['applied']);
    expect(normalizeRecruitmentApplicationStages('FINAL')).toEqual(['final']);
  });

  it('passes through lowercase prisma values', () => {
    expect(normalizeRecruitmentApplicationStages('phone_screen')).toEqual(['phone_screen']);
    expect(normalizeRecruitmentApplicationStages('interview')).toEqual(['interview']);
  });

  it('dedupes and supports comma-separated lists', () => {
    expect(normalizeRecruitmentApplicationStages('INTERVIEW,interview,OFFER')).toEqual(['interview', 'offer']);
  });

  it('lowercases unknown tokens', () => {
    expect(normalizeRecruitmentApplicationStages('Custom_Stage')).toEqual(['custom_stage']);
  });
});
