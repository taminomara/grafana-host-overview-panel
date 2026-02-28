import { createContext, useContext } from 'react';
import { DataFrame, InterpolateFunction, TimeRange } from '@grafana/data';
import { JoinIndex } from '../library/joinFrames';

export interface HostViewerPanelContext {
  data: DataFrame[];
  replaceVariables: InterpolateFunction;
  joinIndices: Map<string, JoinIndex>;
  timeRange: TimeRange;
}

const defaultContext: HostViewerPanelContext = {
  data: [],
  replaceVariables: (value) => value,
  joinIndices: new Map(),
  timeRange: { from: undefined as any, to: undefined as any, raw: { from: 'now-6h', to: 'now' } },
};

const Context = createContext<HostViewerPanelContext>(defaultContext);

export const HostViewerPanelContextProvider = Context.Provider;

export function useHostViewerPanelContext(): HostViewerPanelContext {
  return useContext(Context);
}
