import { css } from '@emotion/css';
import { GrafanaTheme2, StandardEditorProps } from '@grafana/data';
import { Button, ColorPicker, useStyles2 } from '@grafana/ui';
import React from 'react';

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
  label: css({
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});

interface ClearableColorPickerProps {
  value?: string;
  onChange: (color: string | undefined) => void;
  placeholder?: string;
}

export const ClearableColorPicker: React.FC<ClearableColorPickerProps> = ({
  value,
  onChange,
  placeholder = 'Override theme default',
}) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.wrapper}>
      <ColorPicker
        key={value ? 1 : 0} // Reset color picker when non-default value is chosen.
        color={value ?? 'transparent'}
        onChange={(color) => onChange(color)}
        enableNamedColors={true}
      >
        {value
          ? undefined
          : ({ ref, showColorPicker, hideColorPicker }) => (
              <Button
                variant="primary"
                fill="text"
                size="sm"
                ref={ref}
                onClick={showColorPicker}
                onMouseLeave={hideColorPicker}
              >
                {placeholder}
              </Button>
            )}
      </ColorPicker>
      {value ? (
        <Button
          variant="secondary"
          fill="text"
          size="sm"
          icon="times"
          aria-label="Reset color"
          title="Reset to default"
          onClick={() => onChange(undefined)}
        />
      ) : null}
    </div>
  );
};

export const ClearableColorPickerEditor = ({
  value,
  onChange,
}: StandardEditorProps<string | undefined>) => {
  return <ClearableColorPicker value={value} onChange={onChange} />;
};
