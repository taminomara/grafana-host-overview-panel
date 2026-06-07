import { PanelModel } from '@grafana/data';
import { migrationHandler } from './migrationHandler';
import { HostViewerOptions } from './types';

function runMigration(options: Record<string, unknown>): HostViewerOptions {
  const panel = { options } as unknown as PanelModel<Partial<HostViewerOptions>>;
  return migrationHandler(panel) as HostViewerOptions;
}

describe('migrationHandler — cellSize', () => {
  it('migrates a number cellSize to a CellSize object with mode=locked', () => {
    const out = runMigration({ cellSize: 25 });
    expect(out.cellSize).toEqual({ width: 25, height: 25, mode: 'locked' });
  });

  it('seeds default cellSize when missing', () => {
    const out = runMigration({});
    expect(out.cellSize).toEqual({ width: 20, height: 20, mode: 'locked' });
  });

  it('migrates an object with locked: true to mode: locked', () => {
    const out = runMigration({ cellSize: { width: 32, height: 18, locked: true } });
    expect(out.cellSize).toEqual({ width: 32, height: 18, mode: 'locked' });
  });

  it('migrates an object with locked: false to mode: free', () => {
    const out = runMigration({ cellSize: { width: 32, height: 18, locked: false } });
    expect(out.cellSize).toEqual({ width: 32, height: 18, mode: 'free' });
  });

  it('defaults to mode: locked when object has neither mode nor locked', () => {
    const out = runMigration({ cellSize: { width: 32, height: 18 } });
    expect(out.cellSize).toEqual({ width: 32, height: 18, mode: 'locked' });
  });

  it('leaves an existing object with mode untouched', () => {
    const existing = { width: 32, height: 18, mode: 'fit' as const };
    const out = runMigration({ cellSize: existing });
    expect(out.cellSize).toEqual(existing);
  });
});

describe('migrationHandler — capitalizeCellText', () => {
  it('defaults to true when missing', () => {
    const out = runMigration({});
    expect(out.capitalizeCellText).toBe(true);
  });

  it('preserves an existing false value', () => {
    const out = runMigration({ capitalizeCellText: false });
    expect(out.capitalizeCellText).toBe(false);
  });

  it('preserves an existing true value', () => {
    const out = runMigration({ capitalizeCellText: true });
    expect(out.capitalizeCellText).toBe(true);
  });
});
