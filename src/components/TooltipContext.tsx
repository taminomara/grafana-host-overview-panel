import { createContext, MutableRefObject, useContext } from 'react';

export interface TooltipContextValue {
  pinnedRef: MutableRefObject<boolean>;
}

const staticRef: MutableRefObject<boolean> = { current: false };

const defaultContext: TooltipContextValue = {
  pinnedRef: staticRef,
};

const Context = createContext<TooltipContextValue>(defaultContext);

export const TooltipContextProvider = Context.Provider;

export function useTooltipContext(): TooltipContextValue {
  return useContext(Context);
}
