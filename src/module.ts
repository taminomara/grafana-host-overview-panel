import { FieldConfigProperty, PanelPlugin } from '@grafana/data';
import { ClearableColorPickerEditor } from './components/settings/ClearableColorPicker';
import { DataFrameEditor } from './components/settings/DataFrameEditor';
import { GRID_TYPE_OPTIONS } from './components/settings/GridTypePicker';
import { GroupsEditor } from './components/settings/GroupsEditor';
import { DisplayEntriesEditorWrapper } from './components/settings/DisplayEntriesEditor';
import { KnownIdsJoinEditorWrapper } from './components/settings/JoinEditor';
import { SortModeEditor, SortPatternEditor } from './components/settings/SortEditor';
import { TemplatePatternEditor } from './components/settings/TemplatePatternEditor';
import { ValueFieldEditor } from './components/settings/ValueFieldEditor';
import { HostViewerPanel } from './components/HostViewerPanel';
import { migrationHandler } from './migrationHandler';
import {
  ResourceDisplayMode,
  FieldDisplayMode,
  GridType,
  HostViewerFieldConfig,
  HostViewerOptions,
  SortMode,
  Join,
} from './types';

export const plugin = new PanelPlugin<HostViewerOptions, HostViewerFieldConfig>(HostViewerPanel)
  .setMigrationHandler(migrationHandler)
  .useFieldConfig({
    standardOptions: {
      [FieldConfigProperty.Unit]: { hideFromDefaults: true },
      [FieldConfigProperty.Min]: { hideFromDefaults: true },
      [FieldConfigProperty.Max]: { hideFromDefaults: true },
      [FieldConfigProperty.FieldMinMax]: { defaultValue: true, hideFromDefaults: true },
      [FieldConfigProperty.Decimals]: { hideFromDefaults: true },
      [FieldConfigProperty.DisplayName]: { hideFromDefaults: true },
      [FieldConfigProperty.NoValue]: {
        defaultValue: 'unknown',
        hideFromDefaults: true,
      },
      [FieldConfigProperty.Thresholds]: {
        defaultValue: {
          mode: 'absolute',
          steps: [{ color: 'text', value: 0 }],
        },
        hideFromDefaults: true,
      },
      [FieldConfigProperty.Mappings]: { hideFromDefaults: true },
      [FieldConfigProperty.Links]: { hideFromDefaults: true },
      [FieldConfigProperty.Color]: {
        defaultValue: { mode: 'thresholds' },
        hideFromDefaults: true,
      },
    },
    disableStandardOptions: [
      // Not sure how to support this yet.
      FieldConfigProperty.Filterable,
      // Actions are still in development, their API is internal/alpha.
      FieldConfigProperty.Actions,
    ],
    useCustomConfig: (builder) => {
      builder.addSelect({
        path: 'displayMode',
        name: 'Display mode',
        description: 'How to render this field in tooltips',
        defaultValue: FieldDisplayMode.Auto,
        hideFromDefaults: true,
        settings: {
          options: [
            { value: FieldDisplayMode.Auto, label: 'Auto' },
            { value: FieldDisplayMode.Text, label: 'Text' },
            { value: FieldDisplayMode.ColoredText, label: 'Colored text' },
            { value: FieldDisplayMode.ColoredBackground, label: 'Colored background' },
            { value: FieldDisplayMode.Gauge, label: 'Gauge' },
            { value: FieldDisplayMode.Sparkline, label: 'Sparkline' },
          ],
        },
      });
    },
  })
  .setPanelOptions((builder) => {
    return builder
      .addCustomEditor({
        id: 'dataFrame',
        path: 'dataFrame',
        name: 'Data frame',
        description: 'Which data frame to visualize. Uses the first one when empty',
        editor: DataFrameEditor,
        defaultValue: '',
      })
      .addCustomEditor({
        id: 'groups',
        path: 'groups',
        name: 'Resource groups',
        editor: GroupsEditor,
        defaultValue: [],
        category: ['Grouping and layout'],
      })
      .addSelect({
        path: 'gridType',
        name: 'Resources layout',
        description: 'Layout of elements in the innermost group',
        defaultValue: GridType.Flow,
        category: ['Grouping and layout'],
        settings: {
          options: GRID_TYPE_OPTIONS,
        },
      })
      .addNumberInput({
        path: 'gridColumns',
        name: 'Grid columns',
        defaultValue: 5,
        category: ['Grouping and layout'],
        settings: {
          min: 1,
          step: 1,
          integer: true,
        },
        showIf: (options) => options.gridType === GridType.Grid,
      })
      .addCustomEditor({
        id: 'borderColor',
        path: 'borderColor',
        name: 'Default border color',
        description: 'Uses theme border color when empty',
        editor: ClearableColorPickerEditor,
        defaultValue: undefined,
        category: ['Grouping and layout'],
      })
      .addCustomEditor({
        id: 'idField',
        path: 'idField',
        name: 'ID field',
        description:
          'Field that represents id of the resource, used primarily for sorting and detecting missing data',
        editor: ValueFieldEditor,
        defaultValue: '',
        category: ['Resource'],
      })
      .addCustomEditor({
        id: 'idSortMode',
        path: 'idSortMode',
        name: 'Sort mode',
        editor: SortModeEditor,
        defaultValue: SortMode.Default,
        category: ['Resource'],
        showIf: (options) => options.idField !== '',
      })
      .addCustomEditor({
        id: 'idSortPattern',
        path: 'idSortPattern',
        name: 'Sort pattern',
        description:
          'Named groups: n1, sa2, etc. (n=numeric, s=string, i=case-insensitive, a=ascending, d=descending, number=priority)',
        editor: SortPatternEditor,
        defaultValue: '',
        category: ['Resource'],
        showIf: (options) => options.idField !== '' && options.idSortMode === SortMode.Custom,
      })
      .addTextInput({
        name: 'Known IDs',
        path: 'knownIds',
        description:
          'List of IDs that will be shown in each group even if datasource returns no data for them',
        defaultValue: '',
        category: ['Resource'],
        settings: {
          placeholder: 'value1, value2, ...',
        },
        showIf: (options) => options.idField !== '',
      })
      .addCustomEditor({
        id: 'knownIdsJoin',
        path: 'knownIdsJoin',
        name: 'Known IDs from join',
        description: 'Read known IDs from a field in another data frame',
        editor: KnownIdsJoinEditorWrapper,
        defaultValue: {
          id: "__known_ids_join__",
          foreignFrame: "",
          foreignField: "",
          keys: [],
        } satisfies Join,
        category: ['Resource'],
        showIf: (options) => options.idField !== '',
      })
      .addCustomEditor({
        id: 'statusField',
        path: 'statusField',
        name: 'Status field',
        description: 'Field that represents status of the resource',
        editor: ValueFieldEditor,
        defaultValue: '',
        category: ['Resource content'],
      })
      .addSelect({
        name: 'Resource display mode',
        path: 'resourceDisplayMode',
        description: 'How to display each resource',
        category: ['Resource content'],
        defaultValue: ResourceDisplayMode.Cell,
        settings: {
          options: [
            {
              label: 'Cell',
              value: ResourceDisplayMode.Cell,
              description: 'Show a simple colored square with tooltip',
            },
            {
              label: 'Cell with text',
              value: ResourceDisplayMode.CellWithText,
              description: 'Show a simple colored square with text and tooltip',
            },
            {
              label: 'Rich table',
              value: ResourceDisplayMode.Rich,
              description: 'Show a table of values instead of tooltip',
            },
          ],
        },
      })
      .addNumberInput({
        path: 'cellSize',
        name: 'Cell size',
        description: 'Size of each resource cell in pixels',
        defaultValue: 20,
        category: ['Resource content'],
        settings: {
          min: 4,
          max: 100,
          step: 1,
          integer: true,
        },
        showIf: (options) =>
          [ResourceDisplayMode.Cell, ResourceDisplayMode.CellWithText].includes(
            options.resourceDisplayMode
          ),
      })
      .addCustomEditor({
        id: 'cellTextField',
        path: 'cellTextField',
        name: 'Cell text field',
        description: 'The field to display in the cell',
        editor: ValueFieldEditor,
        defaultValue: '',
        category: ['Resource content'],
        settings: {
          placeholder: 'Use resource ID',
          additionalOptions: [
            {
              label: 'Use custom pattern',
              value: '__use_pattern__',
              description: 'Provide custom title using template language',
            },
          ],
        },
        showIf: (options) => options.resourceDisplayMode === ResourceDisplayMode.CellWithText,
      })
      .addCustomEditor({
        id: 'cellTextPattern',
        path: 'cellTextPattern',
        name: 'Cell text pattern',
        description: 'The pattern can use template variables',
        editor: TemplatePatternEditor,
        defaultValue: '',
        showIf: (options) =>
          options.resourceDisplayMode === ResourceDisplayMode.CellWithText &&
          options.cellTextField === '__use_pattern__',
        category: ['Resource content'],
      })
      .addCustomEditor({
        id: 'richTitleField',
        path: 'cellTextField',
        name: 'Title field',
        description: 'The field to display as the resource title',
        editor: ValueFieldEditor,
        defaultValue: '',
        category: ['Resource content'],
        settings: {
          placeholder: 'Use resource ID',
          additionalOptions: [
            {
              label: 'Use custom pattern',
              value: '__use_pattern__',
              description: 'Provide custom title using template language',
            },
          ],
        },
        showIf: (options) => options.resourceDisplayMode === ResourceDisplayMode.Rich,
      })
      .addCustomEditor({
        id: 'richTitlePattern',
        path: 'cellTextPattern',
        name: 'Title pattern',
        description: 'The pattern can use template variables',
        editor: TemplatePatternEditor,
        defaultValue: '',
        category: ['Resource content'],
        showIf: (options) =>
          options.resourceDisplayMode === ResourceDisplayMode.Rich &&
          options.cellTextField === '__use_pattern__',
      })
      .addCustomEditor({
        id: 'displayEntries',
        path: 'displayEntries',
        name: 'Fields and joins',
        description: 'Fields and joined data to display in each resource',
        editor: DisplayEntriesEditorWrapper,
        defaultValue: [],
        category: ['Resource content'],
      })
      .addCustomEditor({
        id: 'tooltipTitleField',
        path: 'tooltipTitleField',
        name: 'Tooltip title field',
        description: 'The field to display in tooltip title',
        editor: ValueFieldEditor,
        defaultValue: '',
        category: ['Resource tooltip'],
        settings: {
          placeholder: 'Use resource ID',
          additionalOptions: [
            {
              label: 'Use custom pattern',
              value: '__use_pattern__',
              description: 'Provide custom title using template language',
            },
          ],
        },
      })
      .addCustomEditor({
        id: 'tooltipTitlePattern',
        path: 'tooltipTitlePattern',
        name: 'Tooltip title pattern',
        description: 'The pattern can use template variables',
        editor: TemplatePatternEditor,
        defaultValue: '',
        showIf: (options) => options.tooltipTitleField === '__use_pattern__',
        category: ['Resource tooltip'],
      });
  });
