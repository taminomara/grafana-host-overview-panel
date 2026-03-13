import { PanelModel } from '@grafana/data';
import { DisplayEntry, HeadingDisplayEntry, HostViewerOptions } from './types';

export function migrationHandler(panel: PanelModel<Partial<HostViewerOptions>>) {
  console.log('!!!');
  const options = { ...panel.options };
  const old = panel.options as Record<string, unknown>;

  if (
    options.displayEntries === undefined &&
    (old.richEntries !== undefined || old.tooltipEntries !== undefined)
  ) {
    const rich: DisplayEntry[] = (old.richEntries as DisplayEntry[]) ?? [];
    const tooltip: DisplayEntry[] = (old.tooltipEntries as DisplayEntry[]) ?? [];

    if (rich.length > 0 && tooltip.length > 0) {
      const heading: HeadingDisplayEntry = {
        id: crypto.randomUUID(),
        type: 'heading',
        title: '',
      };
      options.displayEntries = [...rich, heading, ...tooltip];
    } else {
      options.displayEntries = [...rich, ...tooltip];
    }
  }

  delete (options as Record<string, unknown>).richEntries;
  delete (options as Record<string, unknown>).tooltipEntries;

  return options;
}
