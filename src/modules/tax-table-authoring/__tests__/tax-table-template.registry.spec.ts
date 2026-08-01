import { TaxTableTemplateRegistry } from '../templates';

describe('TaxTableTemplateRegistry', () => {
  const registry = new TaxTableTemplateRegistry();

  it('returns LS template by country/type/year', () => {
    const template = registry.get('LS', 'PAYE', '2025/2026');
    expect(template).not.toBeNull();
    expect(template?.templateCode).toBe('LS_PAYE_2025_2026_DEFAULT');
  });

  it('returns ZA template by country/type/year', () => {
    const template = registry.get('ZA', 'PAYE', '2025/2026');
    expect(template).not.toBeNull();
    expect(template?.templateCode).toBe('ZA_PAYE_2025_2026_DEFAULT');
  });

  it('returns template by id', () => {
    const template = registry.getById('tmpl-za-paye-2025-2026-v1');
    expect(template).not.toBeNull();
    expect(template?.countryCode).toBe('ZA');
  });

  it('returns null for unknown country', () => {
    expect(registry.get('BW', 'PAYE', '2025/2026')).toBeNull();
  });

  it('returns null for unknown template id', () => {
    expect(registry.getById('nonexistent')).toBeNull();
  });

  it('has() returns true for registered templates', () => {
    expect(registry.has('ZA', 'PAYE', '2025/2026')).toBe(true);
    expect(registry.has('LS', 'PAYE', '2025/2026')).toBe(true);
  });

  it('has() returns false for unregistered', () => {
    expect(registry.has('BW', 'PAYE', '2025/2026')).toBe(false);
  });

  it('lists active templates', () => {
    const templates = registry.listAvailable();
    expect(templates.length).toBeGreaterThanOrEqual(2);
    expect(templates.every((t) => t.status === 'ACTIVE')).toBe(true);
  });

  it('lists by country', () => {
    const ls = registry.listByCountry('LS');
    expect(ls.every((t) => t.countryCode === 'LS')).toBe(true);
    const za = registry.listByCountry('ZA');
    expect(za.every((t) => t.countryCode === 'ZA')).toBe(true);
  });

  it('getRecommended returns same as get', () => {
    const recommended = registry.getRecommended('ZA', 'PAYE', '2025/2026');
    const direct = registry.get('ZA', 'PAYE', '2025/2026');
    expect(recommended).toEqual(direct);
  });

  it('toCardDto produces correct shape', () => {
    const template = registry.get('ZA', 'PAYE', '2025/2026')!;
    const card = registry.toCardDto(template, true);
    expect(card.bracketCount).toBe(7);
    expect(card.recommended).toBe(true);
    expect(card.includedFieldLabels.length).toBeGreaterThan(0);
  });
});
