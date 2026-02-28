import React, { createContext, useContext, useMemo } from 'react';
import {
  StandardEditorContext,
  StandardEditorProps,
  VariableOrigin,
  VariableSuggestion,
  VariableSuggestionsScope,
} from '@grafana/data';
import { DataLinkInput } from '@grafana/ui';
import { HostViewerOptions } from '../../types';

const TIME_VARIABLES = new Set([
  '__from',
  '__to',
  '__timezone',
  '__interval',
  '__interval_ms',
  '__url_time_range',
  '__all_variables',
]);

function cleanSuggestions(raw: VariableSuggestion[]): VariableSuggestion[] {
  return raw
    .filter((s) => !TIME_VARIABLES.has(s.value))
    .map((s) => ({
      ...s,
      origin: s.origin === VariableOrigin.Template ? ('global' as VariableOrigin) : s.origin,
    }));
}

const SuggestionsContext = createContext<VariableSuggestion[]>([]);

export function useSuggestions(): VariableSuggestion[] {
  return useContext(SuggestionsContext);
}

export const SuggestionsFromEditorContext: React.FC<
  React.PropsWithChildren<{ context: StandardEditorContext<HostViewerOptions> }>
> = ({ context, children }) => {
  const suggestions = useMemo(
    () =>
      cleanSuggestions(
        context.getSuggestions ? context.getSuggestions(VariableSuggestionsScope.Values) : []
      ),
    [context]
  );
  return <SuggestionsContext.Provider value={suggestions}>{children}</SuggestionsContext.Provider>;
};

interface TemplatePatternInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const TemplatePatternInput: React.FC<TemplatePatternInputProps> = ({
  value,
  onChange,
  placeholder,
}) => {
  const suggestions = useSuggestions();
  return (
    <DataLinkInput
      value={value}
      onChange={onChange}
      suggestions={suggestions}
      placeholder={placeholder ?? 'e.g. ${__data.fields.hostname}'}
    />
  );
};

export const TemplatePatternEditor = ({
  value,
  onChange,
  context,
}: StandardEditorProps<string, unknown, HostViewerOptions>) => {
  return (
    <SuggestionsFromEditorContext context={context}>
      <TemplatePatternInput value={value ?? ''} onChange={onChange} />
    </SuggestionsFromEditorContext>
  );
};
