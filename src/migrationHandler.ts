import { PanelModel } from '@grafana/data';
import { DisplayEntry, Group, HostViewerOptions, SeparatorDisplayEntry } from './types';

function renameJoinFields(obj: Record<string, unknown>) {
  if ('sourceFrame' in obj && !('foreignFrame' in obj)) {
    obj.foreignFrame = obj.sourceFrame;
    delete obj.sourceFrame;
  }
  if ('sourceField' in obj && !('foreignField' in obj)) {
    obj.foreignField = obj.sourceField;
    delete obj.sourceField;
  }
}

function addKnownIdsJoin(group: Group) {
  if (!('knownIdsJoin' in group)) {
    (group as Group).knownIdsJoin = {
      id: crypto.randomUUID(),
      foreignFrame: '',
      foreignField: '',
      keys: [],
    }
  }
}

export function migrationHandler(panel: PanelModel<Partial<HostViewerOptions>>) {
  const options = { ...panel.options };
  const old = panel.options as Record<string, unknown>;

  if (
    options.displayEntries === undefined &&
    (old.richEntries !== undefined || old.tooltipEntries !== undefined)
  ) {
    const rich: DisplayEntry[] = (old.richEntries as DisplayEntry[]) ?? [];
    const tooltip: DisplayEntry[] = (old.tooltipEntries as DisplayEntry[]) ?? [];

    if (rich.length > 0 && tooltip.length > 0) {
      const separator: SeparatorDisplayEntry = {
        id: crypto.randomUUID(),
        type: 'separator',
      };
      options.displayEntries = [...rich, separator, ...tooltip];
    } else {
      options.displayEntries = [...rich, ...tooltip];
    }
  }

  delete (options as Record<string, unknown>).richEntries;
  delete (options as Record<string, unknown>).tooltipEntries;

  for (const entry of options.displayEntries ?? []) {
    if (entry.type === 'join') {
      renameJoinFields(entry as unknown as Record<string, unknown>);
    }
  }

  if (options.knownIdsJoin) {
    renameJoinFields(options.knownIdsJoin as unknown as Record<string, unknown>);
  }

  for (const group of options.groups ?? []) {
    addKnownIdsJoin(group);
    for (const entry of group.entries ?? []) {
      if (entry.type === 'join') {
        renameJoinFields(entry as unknown as Record<string, unknown>);
      }
    }
    if (group.knownIdsJoin) {
      renameJoinFields(group.knownIdsJoin as unknown as Record<string, unknown>);
    }
  }

  return options;
}
