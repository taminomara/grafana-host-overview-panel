import { Field, FieldType } from '@grafana/data';
import { HostViewerPanelContext } from 'components/PanelContext';
import {
  DisplayEntry,
  GridType,
  Group,
  HostViewerOptions,
  Join,
  isGroupDisabled,
  SortMode,
} from '../types';
import { createFrame, IndexedFrame } from './dataFrame';
import { KEY_SEPARATOR } from './joinFrames';

export interface GroupNode {
  groupKey: string;
  groupValues: Record<string, unknown>;
  showTitle: boolean;
  showKeyName: boolean;
  titlePattern?: string;
  gridType: GridType;
  gridColumns: number;
  drawBorder: boolean;
  borderColor?: string;
  transparentBackground: boolean;
  frame: IndexedFrame;
  children: GroupNode[];
  entries: DisplayEntry[];
}

interface CustomSortable {
  key: string;
  sortValue: number | string;
  customSortKeys?: Array<string | number>;
}

interface Bucket extends CustomSortable {
  frame: IndexedFrame;
}

interface SortEntry extends CustomSortable {
  index: number;
}

function fieldValueToKey(field: Field, raw: unknown): { key: string; sortValue: number | string } {
  switch (field.type) {
    case FieldType.number:
    case FieldType.time: {
      const num = Number(raw);
      if (isNaN(num)) {
        return { key: String(raw), sortValue: String(raw) };
      }
      return { key: String(raw), sortValue: num };
    }
    case FieldType.boolean:
      return { key: raw ? 'true' : 'false', sortValue: raw ? 1 : 0 };
    case FieldType.string:
    case FieldType.enum:
      return { key: String(raw), sortValue: String(raw) };
    default:
      return { key: String(raw), sortValue: String(raw) };
  }
}

interface CustomSortGroup {
  name: string;
  type: 'n' | 's' | 'i';
  direction: 'a' | 'd';
  order: number;
}

interface ParsedCustomSort {
  regex: RegExp;
  groups: CustomSortGroup[];
}

export function parseCustomSortPattern(pattern: string): ParsedCustomSort {
  const regex = new RegExp(pattern);

  const groupRegex = /\(\?<([^>]+)>/g;
  const groupNameRegex = /^(?<type>[nsi])(?<direction>[ad])?(?<order>\d+)?$/;
  const sortGroups: CustomSortGroup[] = [];
  let match;
  while ((match = groupRegex.exec(pattern)) !== null) {
    const name = match[1];
    const groups = groupNameRegex.exec(name)?.groups;
    if (!groups) {
      throw new Error(`Invalid sorting group ${match[1]}`);
    }
    const order = groups.order !== undefined ? parseInt(groups.order, 10) : sortGroups.length;
    sortGroups.push({
      name,
      type: groups.type as 'n' | 's' | 'i',
      direction: groups.direction as 'a' | 'd',
      order,
    });
  }

  if (sortGroups.length === 0) {
    throw new Error('Pattern must contain named groups like (?<n1>...) or (?<sd2>...)');
  }

  sortGroups.sort((a, b) => a.order - b.order);
  return { regex, groups: sortGroups };
}

function tryParseCustomSortPattern(pattern: string): ParsedCustomSort | null {
  try {
    return parseCustomSortPattern(pattern);
  } catch {
    return null;
  }
}

function computeCustomSortKeys(
  bucketKey: string,
  parsed: ParsedCustomSort
): Array<string | number> | undefined {
  const groups = parsed.regex.exec(bucketKey)?.groups;
  if (!groups) {
    return undefined;
  }
  return parsed.groups.map((g) => {
    let val: string | number = groups[g.name] ?? '';
    return g.type === 'n' ? Number(val) : val;
  });
}

function compareCustomSortKeys(
  a: Array<string | number>,
  b: Array<string | number>,
  groups: CustomSortGroup[]
): number {
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const va = a[i];
    const vb = b[i];
    let cmp: number;

    if (group.type === 'n') {
      cmp = (va as number) - (vb as number);
      if (isNaN(cmp)) {
        cmp = String(va).localeCompare(String(vb));
      }
    } else if (group.type === 's') {
      cmp = String(va).localeCompare(String(vb));
    } else {
      cmp = String(va).localeCompare(String(vb), undefined, { sensitivity: 'base' });
    }
    if (cmp !== 0) {
      if (group.direction === 'd') {
        cmp = -cmp;
      }
      return cmp;
    }
  }
  return 0;
}

function compareCustomSortables(
  a: CustomSortable,
  b: CustomSortable,
  sortMode: SortMode,
  customGroups?: CustomSortGroup[]
): number {
  switch (sortMode) {
    case SortMode.Custom: {
      const aHas = a.customSortKeys != null;
      const bHas = b.customSortKeys != null;
      if (aHas && bHas) {
        return compareCustomSortKeys(a.customSortKeys!, b.customSortKeys!, customGroups!);
      }
      if (aHas !== bHas) {
        return aHas ? -1 : 1;
      }
      return compareCustomSortables(a, b, SortMode.Default);
    }
    case SortMode.Lexicographic:
      return String(a.sortValue).localeCompare(String(b.sortValue));
    case SortMode.LexicographicInsensitive:
      return String(a.sortValue).localeCompare(String(b.sortValue), undefined, {
        sensitivity: 'base',
      });
    case SortMode.Numeric: {
      const na = Number(a.sortValue);
      const nb = Number(b.sortValue);
      if (!isNaN(na) && !isNaN(nb)) {
        return na - nb;
      }
      return String(a.sortValue).localeCompare(String(b.sortValue));
    }
    case SortMode.Disabled:
      return 0;
    case SortMode.Default:
    default:
      if (typeof a.sortValue === 'number' && typeof b.sortValue === 'number') {
        return a.sortValue - b.sortValue;
      }
      return String(a.sortValue).localeCompare(String(b.sortValue));
  }
}

export function parseKnownIds(knownIds: string): Set<string> {
  return new Set(
    (knownIds || '')
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
  );
}

export function resolveKnownIdsFromJoin(
  join: Join | undefined,
  context: HostViewerPanelContext,
  groupValues: Record<string, unknown>
): Set<string> {
  const result = new Set<string>();
  if (!join?.sourceField) {
    return result;
  }

  const index = context.joinIndices.get(join.id);
  if (!index) {
    return result;
  }

  const sourceField = index.frame.fieldByName.get(join.sourceField);
  if (!sourceField) {
    return result;
  }

  const parts: string[] = [];
  for (const pair of join.keys) {
    parts.push(String(groupValues[pair.primaryKey] ?? ''));
  }
  const compositeKey = parts.join(KEY_SEPARATOR);

  const matchedRows = index.getKeyMap().get(compositeKey);
  if (!matchedRows) {
    return result;
  }

  for (const rowIndex of matchedRows) {
    result.add(String(sourceField.values[rowIndex]));
  }
  return result;
}

function bucketByField(
  frame: IndexedFrame,
  field: Field,
  sortMode: SortMode,
  sortPattern: string | undefined,
  context: HostViewerPanelContext,
  knownValuesSet: Set<string>
): Bucket[] {
  const bucketMap = new Map<string, Bucket>();
  knownValuesSet = new Set(knownValuesSet);
  const fieldCount = frame.fields.length;

  for (let rowIndex = 0; rowIndex < frame.length; rowIndex++) {
    const { key, sortValue } = fieldValueToKey(field, field.values[rowIndex]);
    let bucket = bucketMap.get(key);
    if (!bucket) {
      knownValuesSet.delete(String(field.values[rowIndex]));
      const fields = frame.fields.map((f) => ({
        ...f,
        values: [] as unknown[],
      }));
      bucket = {
        key,
        sortValue,
        frame: createFrame({ ...frame, fields, length: 0 }, context),
      };
      bucketMap.set(key, bucket);
    }
    for (let fi = 0; fi < fieldCount; fi++) {
      (bucket.frame.fields[fi].values as unknown[]).push(frame.fields[fi].values[rowIndex]);
    }
    bucket.frame.length++;
  }

  const buckets = [...bucketMap.values()];

  if (knownValuesSet.size > 0) {
    const fakeFrame = createFrame(
      {
        ...frame,
        length: 0,
        fields: frame.fields.map((fakeField) => {
          return { ...fakeField, values: [] };
        }),
      },
      context
    );

    for (const knownValue of knownValuesSet) {
      const { key, sortValue } = fieldValueToKey(field, knownValue);
      buckets.push({
        key,
        sortValue,
        frame: fakeFrame,
      });
    }
  }

  let customGroups: CustomSortGroup[] | undefined;
  if (sortMode === SortMode.Custom && sortPattern) {
    const parsed = tryParseCustomSortPattern(sortPattern);
    if (parsed) {
      customGroups = parsed.groups;
      for (const bucket of buckets) {
        bucket.customSortKeys = computeCustomSortKeys(bucket.key, parsed);
      }
    }
  }

  if (sortMode !== SortMode.Disabled) {
    buckets.sort((a, b) => compareCustomSortables(a, b, sortMode, customGroups));
  }

  return buckets;
}

function sortFrame(
  frame: IndexedFrame,
  sortFieldName: string,
  sortMode: SortMode,
  sortPattern: string | undefined,
  context: HostViewerPanelContext
): IndexedFrame {
  if (sortMode === SortMode.Disabled) {
    return frame;
  }

  const field = frame.fieldByName.get(sortFieldName);
  if (!field || frame.length <= 1) {
    return frame;
  }

  const entries: SortEntry[] = [];
  for (let i = 0; i < frame.length; i++) {
    const { key, sortValue } = fieldValueToKey(field, field.values[i]);
    entries.push({ index: i, key, sortValue });
  }

  let customGroups: CustomSortGroup[] | undefined;
  if (sortMode === SortMode.Custom && sortPattern) {
    const parsed = tryParseCustomSortPattern(sortPattern);
    if (parsed) {
      customGroups = parsed.groups;
      for (const entry of entries) {
        entry.customSortKeys = computeCustomSortKeys(entry.key, parsed);
      }
    }
  }

  entries.sort((a, b) => compareCustomSortables(a, b, sortMode, customGroups));

  const sortedIndices = entries.map((e) => e.index);
  const newFields = frame.fields.map((f) => ({
    ...f,
    values: sortedIndices.map((i) => f.values[i]),
  }));

  return createFrame({ ...frame, fields: newFields }, context);
}

export function groupFrame(
  frame: IndexedFrame,
  options: HostViewerOptions,
  context: HostViewerPanelContext
): GroupNode {
  const activeGroups = options.groups.filter((g) => !isGroupDisabled(g));
  const gridType = activeGroups.length > 0 ? activeGroups[0].gridType : options.gridType;
  const gridColumns = activeGroups.length > 0 ? activeGroups[0].gridColumns : options.gridColumns;
  const sortedFrame = activeGroups.length === 0 ? applySortFrame(frame, options, context) : frame;
  const [modifiedFrame, children] = groupFrameRecursive(
    sortedFrame,
    activeGroups,
    options,
    context,
    {}
  );
  return {
    groupKey: '',
    groupValues: {},
    showTitle: false,
    showKeyName: false,
    gridType,
    gridColumns,
    drawBorder: false,
    transparentBackground: true,
    frame: modifiedFrame,
    children,
    entries: [],
  };
}

function applySortFrame(
  frame: IndexedFrame,
  options: HostViewerOptions,
  context: HostViewerPanelContext
): IndexedFrame {
  if (!options.idField || !options.idSortMode) {
    return frame;
  }
  return sortFrame(frame, options.idField, options.idSortMode, options.idSortPattern, context);
}

function groupFrameRecursive(
  frame: IndexedFrame,
  groups: Group[],
  options: HostViewerOptions,
  context: HostViewerPanelContext,
  groupValues: Record<string, unknown>
): [IndexedFrame, GroupNode[]] {
  if (groups.length === 0) {
    return [addKnownNodeValues(frame, options, groupValues, context), []];
  }

  const [group, ...remainingGroups] = groups;
  const field = frame.fieldByName.get(group.groupKey);

  const gridType = remainingGroups.length > 0 ? remainingGroups[0].gridType : options.gridType;
  const gridColumns =
    remainingGroups.length > 0 ? remainingGroups[0].gridColumns : options.gridColumns;

  if (!field) {
    const [modifiedFrame, children] = groupFrameRecursive(
      frame,
      remainingGroups,
      options,
      context,
      groupValues
    );
    return [
      modifiedFrame,
      [
        {
          groupKey: group.groupKey,
          groupValues,
          showTitle: group.showTitle,
          showKeyName: group.showKeyName,
          titlePattern: group.titlePattern,
          gridType,
          gridColumns,
          drawBorder: group.drawBorder,
          borderColor: group.borderColor,
          transparentBackground: group.transparentBackground,
          frame: modifiedFrame,
          children,
          entries: group.entries ?? [],
        },
      ],
    ];
  }

  const knownIdsSet = parseKnownIds(group.knownIds);
  for (const id of resolveKnownIdsFromJoin(group.knownIdsJoin, context, groupValues)) {
    knownIdsSet.add(id);
  }

  const buckets = bucketByField(
    frame,
    field,
    group.sortMode ?? SortMode.Default,
    group.sortPattern,
    context,
    knownIdsSet
  );
  return [
    frame,
    buckets.map(({ frame: partitionFrame, key }) => {
      const bucketGroupValues = { ...groupValues, [field.name]: key };
      const [modifiedFrame, children] = groupFrameRecursive(
        partitionFrame,
        remainingGroups,
        options,
        context,
        bucketGroupValues
      );
      return {
        groupKey: group.groupKey,
        groupValues: bucketGroupValues,
        showTitle: group.showTitle,
        showKeyName: group.showKeyName,
        titlePattern: group.titlePattern,
        gridType,
        gridColumns,
        drawBorder: group.drawBorder,
        borderColor: group.borderColor,
        transparentBackground: group.transparentBackground,
        frame: modifiedFrame,
        children,
        entries: group.entries ?? [],
      };
    }),
  ];
}

function addKnownNodeValues(
  frame: IndexedFrame,
  options: HostViewerOptions,
  groupValues: Record<string, unknown>,
  context: HostViewerPanelContext
) {
  const field = frame.fields.find((field) => field.name === options.idField);

  if (!field) {
    return frame;
  }

  const knownValuesSet = parseKnownIds(options.knownIds);
  for (const id of resolveKnownIdsFromJoin(options.knownIdsJoin, context, groupValues)) {
    knownValuesSet.add(id);
  }

  for (const value of field.values) {
    knownValuesSet.delete(String(value));
    if (knownValuesSet.size === 0) {
      return applySortFrame(frame, options, context);
    }
  }

  const newFrame = createFrame(
    {
      ...frame,
      length: frame.length + knownValuesSet.size,
      fields: frame.fields.map((field) => {
        return { ...field, values: [...field.values] };
      }),
    },
    context
  );

  for (const value of knownValuesSet) {
    for (const field of newFrame.fields) {
      if (field.name === options.idField) {
        field.values.push(value);
      } else {
        field.values.push(groupValues[field.name]);
      }
    }
  }
  return applySortFrame(newFrame, options, context);
}
