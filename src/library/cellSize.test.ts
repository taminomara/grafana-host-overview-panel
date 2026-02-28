import { getCellSizeTier } from './cellSize';

describe('getCellSizeTier', () => {
  it('returns cellL for sizes above 20', () => {
    expect(getCellSizeTier(21)).toBe('cellL');
    expect(getCellSizeTier(30)).toBe('cellL');
    expect(getCellSizeTier(100)).toBe('cellL');
  });

  it('returns cellM for sizes 16-20', () => {
    expect(getCellSizeTier(16)).toBe('cellM');
    expect(getCellSizeTier(18)).toBe('cellM');
    expect(getCellSizeTier(20)).toBe('cellM');
  });

  it('returns cellS for sizes 15 and below', () => {
    expect(getCellSizeTier(15)).toBe('cellS');
    expect(getCellSizeTier(10)).toBe('cellS');
    expect(getCellSizeTier(1)).toBe('cellS');
  });
});
