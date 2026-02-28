import { DataFrame, Field, getLinksSupplier } from '@grafana/data';
import { HostViewerPanelContext } from 'components/PanelContext';

export interface IndexedFrame extends DataFrame {
  fieldByName: ReadonlyMap<string, Field>;
}

export function indexFrame(frame: DataFrame): IndexedFrame {
  const fieldByName = new Map<string, Field>();
  for (const field of frame.fields) {
    fieldByName.set(field.name, field);
  }
  return { ...frame, fieldByName };
}

export function createFrame(frame: DataFrame, context: HostViewerPanelContext): IndexedFrame {
  const indexedFrame = indexFrame(frame);
  for (const field of indexedFrame.fields) {
    field.getLinks = getLinksSupplier(
      indexedFrame,
      field,
      {
        __dataContext: {
          value: {
            data: context.data,
            frame: indexedFrame,
            field,
            rowIndex: 0,
          },
        },
      },
      context.replaceVariables
    );
  }
  return indexedFrame;
}
