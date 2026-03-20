export interface JoinKeyPair {
  primaryKey: string | '__template__';
  primaryKeyTemplate: string;
  foreignField: string;
}

export interface SeverityOverride {
  color: string;
  severity: number;
}

export interface FieldDisplayEntry {
  id: string;
  type: 'field';
  hidden?: boolean;
  field: string;
  overridesBorderColor: boolean;
  severityOverrides?: SeverityOverride[];
}

export interface Join {
  id: string;
  foreignFrame: string;
  foreignField: string;
  keys: JoinKeyPair[];
}

export interface JoinDisplayEntry extends Join {
  type: 'join';
  hidden?: boolean;
  overridesBorderColor: boolean;
  severityOverrides?: SeverityOverride[];
}

export interface HeadingDisplayEntry {
  id: string;
  type: 'heading';
  hidden?: boolean;
  title: string;
}

export interface SeparatorDisplayEntry {
  id: string;
  type: 'separator';
  hidden?: boolean;
}

export type DisplayEntry =
  | FieldDisplayEntry
  | JoinDisplayEntry
  | HeadingDisplayEntry
  | SeparatorDisplayEntry;

export interface HostViewerOptions {
  dataFrame?: string;
  displayEntries: DisplayEntry[];
  groups: Group[];
  statusField: string;
  statusJoin: Join;
  cellSize: number;
  idField: string;
  idSortMode: SortMode;
  idSortPattern: string;
  knownIds: string;
  knownIdsJoin: Join;
  resourceDisplayMode: ResourceDisplayMode;
  cellTextField: string;
  cellTextPattern: string;
  titleField: string;
  titlePattern: string;
  gridType: GridType;
  gridColumns: number;
  borderColor?: string;
  sidecarField: string;
  sidecarIds: string;
  sidecarJoin: Join;
}

export interface Group {
  id: string;
  groupKey: string;
  disabled?: boolean;
  showTitle: boolean;
  showKeyName: boolean;
  titlePattern?: string;
  sortMode: SortMode;
  sortPattern?: string;
  gridType: GridType;
  gridColumns: number;
  drawBorder: boolean;
  knownIds: string;
  knownIdsJoin: Join;
  transparentBackground: boolean;
  borderColor?: string;
  entries: DisplayEntry[];
}

export function isGroupDisabled(group: Group): boolean {
  return group.disabled === true || !group.groupKey.trim();
}

export enum SortMode {
  Disabled = 'disabled',
  Default = 'default',
  Lexicographic = 'lexicographic',
  LexicographicInsensitive = 'lexicographic-insensitive',
  Numeric = 'numeric',
  Custom = 'custom',
}

export enum GridType {
  Horizontal = 'horizontal',
  Vertical = 'vertical',
  Flow = 'flow',
  Grid = 'grid',
}

export enum FieldDisplayMode {
  Auto = 'auto',
  Text = 'text',
  ColoredText = 'colored-text',
  ColoredBackground = 'colored-background',
  Gauge = 'gauge',
  Sparkline = 'sparkline',
}

export enum ResourceDisplayMode {
  Cell = 'cell',
  CellWithText = 'cell-with-text',
  Rich = 'rich',
}

export interface HostViewerFieldConfig {
  displayMode: FieldDisplayMode;
}
