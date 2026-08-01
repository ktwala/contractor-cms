import { formatContractorBusinessId } from './ctr-format';

describe('formatContractorBusinessId', () => {
  it('formats CTR with padded sequence', () => {
    expect(formatContractorBusinessId('LSO', 1)).toBe('CTR-LSO-00000001');
    expect(formatContractorBusinessId('LSO', 42)).toBe('CTR-LSO-00000042');
  });
});
