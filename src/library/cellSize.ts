/** Tier buckets for cell-size-dependent styles. */
export type CellSizeTier = 'cellS' | 'cellM' | 'cellL';

export function getCellSizeTier(cellSize: number): CellSizeTier {
  if (cellSize > 20) {
    return 'cellL';
  }
  if (cellSize > 15) {
    return 'cellM';
  }
  return 'cellS';
}
