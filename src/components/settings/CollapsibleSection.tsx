import React, { useState } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';

const getStyles = (theme: GrafanaTheme2) => ({
  header: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    cursor: 'pointer',
    userSelect: 'none',
    padding: theme.spacing(0.5, 0),
    fontWeight: theme.typography.fontWeightMedium,
  }),
  chevron: css({
    color: theme.colors.text.secondary,
  }),
  description: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    marginTop: theme.spacing(-0.5),
    marginBottom: theme.spacing(1),
  }),
  body: css({
    padding: theme.spacing(1, 0, 1, 2),
    borderLeftWidth: 1,
    borderLeftStyle: 'solid',
    borderLeftColor: theme.colors.border.weak,
  }),
});

interface CollapsibleSectionProps {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  description,
  defaultOpen = true,
  children,
}) => {
  const styles = useStyles2(getStyles);
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div>
      <div className={styles.header} onClick={() => setIsOpen(!isOpen)}>
        <Icon name={isOpen ? 'angle-down' : 'angle-right'} className={styles.chevron} />
        {title}
      </div>
      {isOpen && <div className={styles.body}>
        {description && <div className={styles.description}>{description}</div>}
        {children}
      </div>}
    </div>
  );
};
