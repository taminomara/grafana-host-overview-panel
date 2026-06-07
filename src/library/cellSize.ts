import { CellSize, CellSizeMode } from '../types';

/** Tier buckets for cell-size-dependent styles. */
export type CellSizeTier = 'cellS' | 'cellM' | 'cellL';

export const CELL_SIZE_MIN = 4;
export const CELL_SIZE_MAX = 100;

export const DEFAULT_CELL_SIZE: CellSize = { width: 20, height: 20, mode: 'locked' };

export function getCellSizeTier(cellSize: number): CellSizeTier {
  if (cellSize > 20) {
    return 'cellL';
  }
  if (cellSize > 15) {
    return 'cellM';
  }
  return 'cellS';
}

export function resolveCellSizeMode(mode: CellSizeMode, allowFit: boolean): CellSizeMode {
  return mode === 'fit' && !allowFit ? 'locked' : mode;
}
