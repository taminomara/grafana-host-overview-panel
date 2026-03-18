import { DataFrame, dateTime, Field, FieldType } from '@grafana/data';
import { ResourceDisplayMode, GridType, Group, HostViewerOptions, SortMode } from '../types';
import { HostViewerPanelContext } from '../components/PanelContext';

let nextId = 0;

export function makeField(name: string, type: FieldType, values: unknown[]): Field {
  return { name, type, values, config: {} };
}

export function makeFrame(fields: Field[], refId?: string): DataFrame {
  return {
    fields,
    length: fields[0]?.values.length ?? 0,
    refId,
  };
}

export function makeGroup(overrides: Partial<Group> & { groupKey: string }): Group {
  return {
    id: `group-${nextId++}`,
    showTitle: false,
    showKeyName: false,
    sortMode: SortMode.Default,
    gridType: GridType.Flow,
    gridColumns: 4,
    drawBorder: false,
    transparentBackground: true,
    knownIds: '',
    knownIdsJoin: {
      id: `group-${nextId}-known-ids`,
      foreignFrame: '',
      foreignField: '',
      keys: [],
    },
    entries: [],
    ...overrides,
  };
}

export function makeOptions(overrides?: Partial<HostViewerOptions>): HostViewerOptions {
  return {
    displayEntries: [],
    groups: [],
    statusField: 'value',
    cellSize: 20,
    resourceDisplayMode: ResourceDisplayMode.Cell,
    tooltipTitleField: '',
    tooltipTitlePattern: '',
    gridType: GridType.Flow,
    gridColumns: 4,
    knownIds: '',
    knownIdsJoin: {
      id: `known-ids`,
      foreignFrame: '',
      foreignField: '',
      keys: [],
    },
    idField: '',
    idSortMode: SortMode.Default,
    idSortPattern: '',
    cellTextField: '',
    cellTextPattern: '',
    ...overrides,
  };
}

export function makePanelContext(
  overrides?: Partial<HostViewerPanelContext>
): HostViewerPanelContext {
  return {
    data: [],
    replaceVariables: (v: string) => v,
    joinIndices: new Map(),
    timeRange: {
      from: dateTime('2026-02-28T06:00:00Z'),
      to: dateTime('2026-02-28T12:00:00Z'),
      raw: { from: 'now-6h', to: 'now' },
    },
    ...overrides,
  };
}
