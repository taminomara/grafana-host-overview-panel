import React from 'react';
import { LinkModel } from '@grafana/data';
import { DataLinksContextMenu, IconButton, useTheme2 } from '@grafana/ui';

interface DataLinksButtonProps {
  links: LinkModel[];
}

export const DataLinksButton: React.FC<DataLinksButtonProps> = ({ links }) => {
  const theme = useTheme2();
  if (links.length === 0) {
    return null;
  }
  return (
    <DataLinksContextMenu links={() => links}>
      {(api) => (
        <IconButton
          name="external-link-alt"
          size="xs"
          onClick={api.openMenu}
          aria-label="Go to data link"
          style={{
            color: theme.colors.text.secondary,
          }}
        />
      )}
    </DataLinksContextMenu>
  );
};
