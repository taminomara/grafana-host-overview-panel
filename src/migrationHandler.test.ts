import { PanelModel } from '@grafana/data';
import { migrationHandler } from './migrationHandler';
import { HostViewerOptions } from './types';

function runMigration(options: Record<string, unknown>): HostViewerOptions {
  const panel = { options } as unknown as PanelModel<Partial<HostViewerOptions>>;
  return migrationHandler(panel) as HostViewerOptions;
}

describe('migrationHandler — cellSize', () => {
  it('migrates a number cellSize to a CellSize object', () => {
    const out = runMigration({ cellSize: 25 });
    expect(out.cellSize).toEqual({ width: 25, height: 25, locked: true });
  });

  it('seeds default cellSize when missing', () => {
    const out = runMigration({});
    expect(out.cellSize).toEqual({ width: 20, height: 20, locked: true });
  });

  it('leaves an existing CellSize object untouched', () => {
    const existing = { width: 32, height: 18, locked: false };
    const out = runMigration({ cellSize: existing });
    expect(out.cellSize).toEqual(existing);
  });
});
