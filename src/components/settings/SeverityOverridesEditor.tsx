import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import {
  Button,
  ColorPicker,
  Icon,
  InlineField,
  InlineFieldRow,
  Input,
  useStyles2,
  useTheme2,
} from '@grafana/ui';
import React, { useEffect, useRef, useState } from 'react';
import { SeverityOverride } from '../../types';

function isTransparent(color: string): boolean {
  if (color === 'transparent') {
    return true;
  }
  const match = color.match(/^#(\d\d\d\d\d\d00|\d\d\d0)$/);
  return match !== null;
}

const getStyles = (theme: GrafanaTheme2) => ({
  row: css({
    alignItems: 'center',
    flexWrap: 'nowrap',
  }),
  swatchWrapper: css({
    display: 'flex',
    alignItems: 'center',
    alignSelf: 'center',
  }),
  swatch: css({
    width: 16,
    height: 16,
    borderRadius: theme.shape.radius.circle,
    cursor: 'pointer',
    padding: 0,
    [theme.transitions.handleMotion('no-preference')]: {
      transition: theme.transitions.create(['transform'], {
        duration: theme.transitions.duration.short,
      }),
    },
    '&:hover': {
      transform: 'scale(1.1)',
    },
  }),
  arrow: css({
    color: theme.colors.text.secondary,
    userSelect: 'none',
  }),
});

interface SeverityOverridesEditorProps {
  value: SeverityOverride[];
  onChange: (overrides: SeverityOverride[]) => void;
}

export const SeverityOverridesEditor: React.FC<SeverityOverridesEditorProps> = ({
  value,
  onChange,
}) => {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const [autoOpenIndex, setAutoOpenIndex] = useState<number | null>(null);
  const awaitingColorRef = useRef<number | null>(null);
  const showPickerRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (autoOpenIndex !== null && showPickerRef.current) {
      showPickerRef.current();
      showPickerRef.current = null;
      setAutoOpenIndex(null);
    }
  }, [autoOpenIndex]);

  return (
    <>
      {value.map((ov, i) => (
        <InlineFieldRow key={i} className={styles.row}>
          <InlineField>
            <ColorPicker
              color={ov.color || '#000000'}
              onChange={(color) => {
                onChange(value.map((o, k) => (k === i ? { ...o, color } : o)));
                if (awaitingColorRef.current === i) {
                  awaitingColorRef.current = null;
                }
              }}
              enableNamedColors={true}
            >
              {({ ref, showColorPicker }) => {
                if (autoOpenIndex === i) {
                  showPickerRef.current = showColorPicker;
                }
                const resolved = theme.visualization.getColorByName(ov.color || '#000000');
                const border = isTransparent(ov.color)
                  ? `2px solid ${theme.colors.border.medium}`
                  : 'none';
                return (
                  <div ref={ref} className={styles.swatchWrapper}>
                    <button
                      className={styles.swatch}
                      style={{ background: resolved, border }}
                      onClick={showColorPicker}
                      type="button"
                      aria-label="Pick a color"
                    />
                  </div>
                );
              }}
            </ColorPicker>
          </InlineField>
          <InlineField>
            <Icon name="arrow-right" className={styles.arrow} />
          </InlineField>
          <InlineField grow={true} shrink={true}>
            <Input
              type="number"
              min={0}
              value={ov.severity}
              onChange={(e) => {
                const severity = parseFloat(e.currentTarget.value);
                if (!isNaN(severity)) {
                  onChange(value.map((o, k) => (k === i ? { ...o, severity } : o)));
                }
              }}
            />
          </InlineField>
          <InlineField>
            <Button
              variant="secondary"
              icon="trash-alt"
              aria-label="Delete severity override"
              title="Delete"
              onClick={() => onChange(value.filter((_, k) => k !== i))}
            />
          </InlineField>
        </InlineFieldRow>
      ))}
      <Button
        variant="secondary"
        size="sm"
        icon="plus"
        onClick={() => {
          const newIndex = value.length;
          awaitingColorRef.current = newIndex;
          setAutoOpenIndex(newIndex);
          onChange([...value, { color: '', severity: 0 }]);
        }}
      >
        Add severity override
      </Button>
    </>
  );
};
