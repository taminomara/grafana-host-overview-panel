import React from 'react';
import { css } from '@emotion/css';
import {
  DataFrame,
  Field,
  FieldConfig,
  FieldSparkline,
  FieldType,
  formattedValueToString,
  getFieldDisplayName,
  getMinMaxAndDelta,
  GrafanaTheme2,
  TimeRange,
} from '@grafana/data';
import { BarGauge, Sparkline, useStyles2, useTheme2 } from '@grafana/ui';
import {
  BarGaugeDisplayMode,
  BarGaugeValueMode,
  GraphDrawStyle,
  GraphGradientMode,
  LineInterpolation,
  VizOrientation,
} from '@grafana/schema';
import { IndexedFrame } from '../library/dataFrame';
import { FieldDisplayMode, HostViewerFieldConfig } from 'types';
import { useHostViewerPanelContext } from './PanelContext';
import { DataLinksButton } from './DataLinksButton';

export const VALUE_HEIGHT = 15;
export const VALUE_WIDTH = 80;

export const getRowStyles = (theme: GrafanaTheme2) => ({
  label: css({
    color: theme.colors.text.secondary,
    display: 'flex',
    flexWrap: 'nowrap',
    gap: theme.spacing(0.5),
  }),
  labelContentWrapper: css({
    display: 'inline-block',
    maxWidth: 150,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    '&:hover': {
      overflow: 'visible',
    },
  }),
  labelContent: css({
    whiteSpace: 'nowrap',
    '&:hover': {
      backgroundColor: theme.colors.background.primary,
    },
  }),
  value: css({
    textAlign: 'left',
  }),
  coloredBackgroundBox: css({
    display: 'inline-block',
    borderRadius: theme.shape.radius.sm,
    padding: theme.spacing(0, 0.5),
    verticalAlign: 'text-top',
    fontSize: '0.7rem',
    height: VALUE_HEIGHT,
    width: VALUE_WIDTH,
    textAlign: 'center',
  }),
  gaugeContainer: css({
    display: 'inline-block',
    width: VALUE_WIDTH,
    height: VALUE_HEIGHT,
    borderRadius: theme.shape.radius.sm,
    backgroundColor: theme.colors.background.elevated,
    verticalAlign: 'text-top',
    overflow: 'hidden',
  }),
  sparklineContainer: css({
    display: 'inline-block',
    width: VALUE_WIDTH,
    height: VALUE_HEIGHT,
    borderRadius: theme.shape.radius.sm,
    backgroundColor: theme.colors.background.elevated,
    verticalAlign: 'text-top',
    overflow: 'hidden',
  }),
});

export function formatFieldValue(f: Field, value: unknown): string {
  return f.display ? formattedValueToString(f.display(value)) : String(value ?? '');
}

export function resolveDisplayMode(field: Field): FieldDisplayMode {
  const custom = field.config.custom as HostViewerFieldConfig | undefined;
  const mode = custom?.displayMode ?? FieldDisplayMode.Auto;
  if (mode !== FieldDisplayMode.Auto) {
    return mode;
  }
  if (
    field.type === FieldType.frame &&
    !field.values.every((value) => ((value as DataFrame).length ?? 1) <= 1)
  ) {
    return FieldDisplayMode.Sparkline;
  } else if (
    [FieldType.frame, FieldType.number].includes(field.type) &&
    field.config.min !== undefined &&
    field.config.min !== null &&
    field.config.max !== undefined &&
    field.config.max !== null
  ) {
    return FieldDisplayMode.Gauge;
  } else if (field.type === FieldType.enum) {
    return FieldDisplayMode.ColoredBackground;
  } else {
    return FieldDisplayMode.ColoredText;
  }
}

function toSparkline(
  df: DataFrame | undefined,
  outerFieldConfig: FieldConfig,
  timeRange?: TimeRange
): FieldSparkline | null {
  if (!df) {
    return null;
  }
  const yField = df.fields.find((f) => f.type === FieldType.number);
  if (!yField || yField.values.length === 0) {
    return null;
  }

  const mergedYField: Field = {
    ...yField,
    config: {
      ...yField.config,
      min: outerFieldConfig.min ?? yField.config.min,
      max: outerFieldConfig.max ?? yField.config.max,
    },
  };

  const range = getMinMaxAndDelta(mergedYField);
  mergedYField.state = { ...mergedYField.state, range };

  const xField = df.fields.find((f) => f.type === FieldType.time);
  return { y: mergedYField, x: xField, timeRange };
}

export interface FieldRowProps {
  field: Field;
  frame: IndexedFrame;
  rowIndex: number | undefined;
}

export const FieldRow: React.FC<FieldRowProps> = ({ field, frame, rowIndex }) => {
  const styles = useStyles2(getRowStyles);
  const theme = useTheme2();
  const { timeRange } = useHostViewerPanelContext();
  const mode = resolveDisplayMode(field);
  const value = rowIndex === undefined ? undefined : field.values[rowIndex];
  const fieldName = getFieldDisplayName(field, frame);
  const displayValue =
    field.display &&
    field.display(field.type === FieldType.frame && value !== undefined ? value.value : value);
  const links = field.getLinks
    ? field.getLinks({
        calculatedValue: displayValue,
        valueRowIndex: rowIndex,
      })
    : [];
  const label = (
    <span className={styles.label}>
      <span className={styles.labelContentWrapper}>
        <span className={styles.labelContent}>{fieldName}</span>
      </span>
      <DataLinksButton links={links} />
    </span>
  );

  switch (mode) {
    case FieldDisplayMode.ColoredBackground: {
      const bgColor = displayValue?.color ?? theme.colors.background.elevated;
      const textColor = theme.colors.getContrastText(bgColor);
      return (
        <>
          {label}
          <span
            className={styles.coloredBackgroundBox}
            style={{ backgroundColor: bgColor, color: textColor }}
          >
            {displayValue ? formattedValueToString(displayValue) : String(value ?? '')}
          </span>
          <div />
        </>
      );
    }
    case FieldDisplayMode.Gauge: {
      return (
        <>
          {label}
          <div className={styles.gaugeContainer}>
            <BarGauge
              value={displayValue}
              field={field.config}
              display={field.display}
              theme={theme}
              width={VALUE_WIDTH}
              height={VALUE_HEIGHT}
              orientation={VizOrientation.Horizontal}
              displayMode={BarGaugeDisplayMode.Basic}
              showUnfilled={true}
              isOverflow={false}
              valueDisplayMode={BarGaugeValueMode.Hidden}
            />
          </div>
          {displayValue ? (
            <span className={styles.value} style={{ color: displayValue.color }}>
              {formattedValueToString(displayValue)}
            </span>
          ) : (
            <span className={styles.value}>{String(value ?? '')}</span>
          )}
        </>
      );
    }
    case FieldDisplayMode.Sparkline: {
      const sparkline = toSparkline(value as DataFrame | undefined, field.config, timeRange);
      if (sparkline) {
        return (
          <>
            {label}
            <div className={styles.sparklineContainer}>
              <Sparkline
                sparkline={sparkline}
                theme={theme}
                width={VALUE_WIDTH}
                height={VALUE_HEIGHT}
                config={{
                  ...field.config,
                  custom: {
                    ...field.config.custom,
                    drawStyle: GraphDrawStyle.Line,
                    gradientMode: GraphGradientMode.None,
                    lineInterpolation: LineInterpolation.Smooth,
                    lineWidth: 0,
                    fillColor: displayValue?.color ?? theme.colors.primary.text,
                    showPoints: false,
                    pointSize: 0,
                  },
                }}
              />
            </div>
            {displayValue ? (
              <span className={styles.value} style={{ color: displayValue.color }}>
                {formattedValueToString(displayValue)}
              </span>
            ) : (
              <span className={styles.value}>{String(value ?? '')}</span>
            )}
          </>
        );
      } else {
        // Fall through to colored text mode.
      }
    }
    case FieldDisplayMode.ColoredText: {
      return (
        <>
          {label}
          <div />
          {displayValue ? (
            <span className={styles.value} style={{ color: displayValue.color }}>
              {formattedValueToString(displayValue)}
            </span>
          ) : (
            <span className={styles.value}>{String(value ?? '')}</span>
          )}
        </>
      );
    }
    default:
      return (
        <>
          {label}
          <div />
          {displayValue ? (
            <span className={styles.value}>{formattedValueToString(displayValue)}</span>
          ) : (
            <span className={styles.value}>{String(value ?? '')}</span>
          )}
        </>
      );
  }
};
