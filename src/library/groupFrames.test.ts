import { FieldType } from '@grafana/data';
import { indexFrame } from './dataFrame';
import { parseCustomSortPattern, groupFrame, GroupNode } from './groupFrames';
import { makeField, makeFrame, makeGroup, makeOptions, makePanelContext } from './testHelpers';
import { GridType, SortMode } from '../types';

jest.mock('@grafana/data', () => ({
  ...jest.requireActual('@grafana/data'),
  getLinksSupplier: jest.fn(() => () => []),
}));

// -- helpers ------------------------------------------------------------------

function childKeys(node: GroupNode): string[] {
  return node.children.map((c) => c.frame.fieldByName.get(c.groupKey)?.values[0] ?? '');
}

function leafValues(node: GroupNode, fieldName: string): unknown[][] {
  if (node.children.length === 0) {
    const field = node.frame.fieldByName.get(fieldName);
    return [field ? [...field.values] : []];
  }
  return node.children.flatMap((c) => leafValues(c, fieldName));
}

// -- parseCustomSortPattern ---------------------------------------------------

describe('parseCustomSortPattern', () => {
  it('supports numeric type', () => {
    const result = parseCustomSortPattern('(?<n1>\\d+)');
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]).toMatchObject({ name: 'n1', type: 'n', order: 1 });
  });

  it('supports string type', () => {
    const result = parseCustomSortPattern('(?<s1>.+)');
    expect(result.groups[0]).toMatchObject({ name: 's1', type: 's', order: 1 });
  });

  it('supports case-insensitive type', () => {
    const result = parseCustomSortPattern('(?<i1>.+)');
    expect(result.groups[0]).toMatchObject({ name: 'i1', type: 'i', order: 1 });
  });

  it('parses multiple groups sorted by order', () => {
    const result = parseCustomSortPattern('(?<s2>[a-z]+)-(?<n1>\\d+)');
    expect(result.groups).toHaveLength(2);
    expect(result.groups[0]).toMatchObject({ name: 'n1', type: 'n', order: 1 });
    expect(result.groups[1]).toMatchObject({ name: 's2', type: 's', order: 2 });
  });

  it('respects direction flags', () => {
    const result = parseCustomSortPattern('(?<na1>\\d+)(?<sd2>[a-z]+)');
    expect(result.groups[0]).toMatchObject({ direction: 'a' });
    expect(result.groups[1]).toMatchObject({ direction: 'd' });
  });

  it('assigns default order when no digit given', () => {
    const result = parseCustomSortPattern('(?<n>.+)');
    expect(result.groups[0].order).toBe(0);
  });

  it('throws on invalid group names', () => {
    expect(() => parseCustomSortPattern('(?<xyz>.*)')).toThrow('Invalid sorting group');
  });

  it('throws on pattern with no named groups', () => {
    expect(() => parseCustomSortPattern('(\\d+)')).toThrow('Pattern must contain named groups');
  });

  it('throws on invalid regex syntax', () => {
    expect(() => parseCustomSortPattern('(?<n1>[invalid')).toThrow();
  });
});

// -- groupFrame: grouping behavior --------------------------------------------

describe('groupFrame', () => {
  const ctx = makePanelContext();

  function sampleFrame() {
    return indexFrame(
      makeFrame([
        makeField('dc', FieldType.string, ['us', 'us', 'eu', 'eu']),
        makeField('rack', FieldType.string, ['r1', 'r2', 'r1', 'r2']),
        makeField('host', FieldType.string, ['h1', 'h2', 'h3', 'h4']),
        makeField('value', FieldType.number, [10, 20, 30, 40]),
      ])
    );
  }

  describe('grouping', () => {
    it('returns root node with no children when no groups configured', () => {
      const frame = sampleFrame();
      const root = groupFrame(frame, makeOptions(), ctx);

      expect(root.children).toHaveLength(0);
      expect(root.frame.length).toBe(4);
      expect(root.showTitle).toBe(false);
    });

    it('partitions frame by a single string group', () => {
      const frame = sampleFrame();
      const opts = makeOptions({
        groups: [makeGroup({ groupKey: 'dc' })],
      });
      const root = groupFrame(frame, opts, ctx);

      expect(root.children).toHaveLength(2);
      const keys = childKeys(root);
      expect(keys).toContain('us');
      expect(keys).toContain('eu');

      const usNode = root.children.find((c) => c.frame.fieldByName.get('dc')?.values[0] === 'us')!;
      expect(usNode.frame.length).toBe(2);
      expect([...usNode.frame.fieldByName.get('host')!.values]).toEqual(['h1', 'h2']);
    });

    it('partitions recursively with multiple groups', () => {
      const frame = sampleFrame();
      const opts = makeOptions({
        groups: [makeGroup({ groupKey: 'dc' }), makeGroup({ groupKey: 'rack' })],
      });
      const root = groupFrame(frame, opts, ctx);

      expect(root.children).toHaveLength(2);
      for (const dcNode of root.children) {
        expect(dcNode.children).toHaveLength(2);
        for (const rackNode of dcNode.children) {
          expect(rackNode.children).toHaveLength(0);
          expect(rackNode.frame.length).toBe(1);
        }
      }
    });

    it('skips disabled groups', () => {
      const frame = sampleFrame();
      const opts = makeOptions({
        groups: [makeGroup({ groupKey: 'dc', disabled: true }), makeGroup({ groupKey: 'rack' })],
      });
      const root = groupFrame(frame, opts, ctx);

      expect(root.children).toHaveLength(2);
      expect(root.children[0].groupKey).toBe('rack');
    });

    it('skips groups with empty groupKey', () => {
      const frame = sampleFrame();
      const opts = makeOptions({
        groups: [makeGroup({ groupKey: '' }), makeGroup({ groupKey: 'dc' })],
      });
      const root = groupFrame(frame, opts, ctx);

      expect(root.children).toHaveLength(2);
      expect(root.children[0].groupKey).toBe('dc');
    });

    it('produces single child when group field is not present', () => {
      const frame = sampleFrame();
      const opts = makeOptions({
        groups: [makeGroup({ groupKey: 'nonexistent' })],
      });
      const root = groupFrame(frame, opts, ctx);

      expect(root.children).toHaveLength(1);
      expect(root.children[0].frame.length).toBe(4);
    });

    it('groups by number field', () => {
      const frame = indexFrame(
        makeFrame([
          makeField('n', FieldType.number, [1, 2, 1, 2]),
          makeField('v', FieldType.string, ['a', 'b', 'c', 'd']),
        ])
      );
      const opts = makeOptions({
        groups: [makeGroup({ groupKey: 'n' })],
      });
      const root = groupFrame(frame, opts, ctx);

      expect(root.children).toHaveLength(2);
      const node1 = root.children.find((c) => c.frame.fieldByName.get('n')?.values[0] === 1)!;
      expect(node1.frame.length).toBe(2);
    });

    it('groups by boolean field', () => {
      const frame = indexFrame(
        makeFrame([
          makeField('b', FieldType.boolean, [true, false, true]),
          makeField('v', FieldType.string, ['a', 'b', 'c']),
        ])
      );
      const opts = makeOptions({
        groups: [makeGroup({ groupKey: 'b' })],
      });
      const root = groupFrame(frame, opts, ctx);

      expect(root.children).toHaveLength(2);
    });

    it('treats null values as empty string key', () => {
      const frame = indexFrame(
        makeFrame([
          makeField('x', FieldType.string, ['a', null, 'a', null]),
          makeField('v', FieldType.number, [1, 2, 3, 4]),
        ])
      );
      const opts = makeOptions({
        groups: [makeGroup({ groupKey: 'x' })],
      });
      const root = groupFrame(frame, opts, ctx);

      expect(root.children).toHaveLength(2);
      const nullNode = root.children.find((c) => c.frame.fieldByName.get('x')?.values[0] === null)!;
      expect(nullNode.frame.length).toBe(2);
    });
  });

  // -- sorting behavior -------------------------------------------------------

  describe('group sorting', () => {
    function sortTestFrame() {
      return indexFrame(
        makeFrame([
          makeField('key', FieldType.string, ['banana', 'apple', 'Cherry']),
          makeField('v', FieldType.number, [1, 2, 3]),
        ])
      );
    }

    it('sorts groups by default (localeCompare for strings)', () => {
      const frame = sortTestFrame();
      const opts = makeOptions({
        groups: [makeGroup({ groupKey: 'key', sortMode: SortMode.Default })],
      });
      const root = groupFrame(frame, opts, ctx);
      const keys = childKeys(root);

      expect(keys).toEqual(['apple', 'banana', 'Cherry']);
    });

    it('sorts groups lexicographically', () => {
      const frame = sortTestFrame();
      const opts = makeOptions({
        groups: [makeGroup({ groupKey: 'key', sortMode: SortMode.Lexicographic })],
      });
      const root = groupFrame(frame, opts, ctx);
      const keys = childKeys(root);

      expect(keys).toEqual(['apple', 'banana', 'Cherry']);
    });

    it('sorts groups lexicographically case-insensitive', () => {
      const frame = sortTestFrame();
      const opts = makeOptions({
        groups: [makeGroup({ groupKey: 'key', sortMode: SortMode.LexicographicInsensitive })],
      });
      const root = groupFrame(frame, opts, ctx);
      const keys = childKeys(root);

      expect(keys).toEqual(['apple', 'banana', 'Cherry']);
    });

    it('sorts groups numerically', () => {
      const frame = indexFrame(
        makeFrame([
          makeField('key', FieldType.string, ['10', '2', '1', '20']),
          makeField('v', FieldType.number, [1, 2, 3, 4]),
        ])
      );
      const opts = makeOptions({
        groups: [makeGroup({ groupKey: 'key', sortMode: SortMode.Numeric })],
      });
      const root = groupFrame(frame, opts, ctx);
      const keys = childKeys(root);

      expect(keys).toEqual(['1', '2', '10', '20']);
    });

    it('preserves original order with SortMode.Disabled', () => {
      const frame = sortTestFrame();
      const opts = makeOptions({
        groups: [makeGroup({ groupKey: 'key', sortMode: SortMode.Disabled })],
      });
      const root = groupFrame(frame, opts, ctx);
      const keys = childKeys(root);

      expect(keys).toEqual(['banana', 'apple', 'Cherry']);
    });

    it('sorts by custom regex pattern', () => {
      const frame = indexFrame(
        makeFrame([
          makeField('key', FieldType.string, ['rack-10', 'rack-2', 'rack-1']),
          makeField('v', FieldType.number, [1, 2, 3]),
        ])
      );
      const opts = makeOptions({
        groups: [
          makeGroup({
            groupKey: 'key',
            sortMode: SortMode.Custom,
            sortPattern: 'rack-(?<n1>\\d+)',
          }),
        ],
      });
      const root = groupFrame(frame, opts, ctx);
      const keys = childKeys(root);

      expect(keys).toEqual(['rack-1', 'rack-2', 'rack-10']);
    });

    it('custom sort puts non-matching values after matching', () => {
      const frame = indexFrame(
        makeFrame([
          makeField('key', FieldType.string, ['rack-3', 'other', 'rack-1']),
          makeField('v', FieldType.number, [1, 2, 3]),
        ])
      );
      const opts = makeOptions({
        groups: [
          makeGroup({
            groupKey: 'key',
            sortMode: SortMode.Custom,
            sortPattern: 'rack-(?<n1>\\d+)',
          }),
        ],
      });
      const root = groupFrame(frame, opts, ctx);
      const keys = childKeys(root);

      expect(keys).toEqual(['rack-1', 'rack-3', 'other']);
    });

    it('sorts numbers numerically in Default mode', () => {
      const frame = indexFrame(
        makeFrame([
          makeField('key', FieldType.number, [10, 2, 1, 20]),
          makeField('v', FieldType.string, ['a', 'b', 'c', 'd']),
        ])
      );
      const opts = makeOptions({
        groups: [makeGroup({ groupKey: 'key', sortMode: SortMode.Default })],
      });
      const root = groupFrame(frame, opts, ctx);
      const keys = root.children.map((c) => c.frame.fieldByName.get('key')?.values[0]);

      expect(keys).toEqual([1, 2, 10, 20]);
    });
  });

  // -- value sorting at leaf level --------------------------------------------

  describe('value sorting', () => {
    it('applies value sort at leaf level', () => {
      const frame = indexFrame(
        makeFrame([
          makeField('dc', FieldType.string, ['us', 'us', 'us']),
          makeField('host', FieldType.string, ['c', 'a', 'b']),
        ])
      );
      const opts = makeOptions({
        groups: [makeGroup({ groupKey: 'dc' })],
        idField: 'host',
        idSortMode: SortMode.Lexicographic,
      });
      const root = groupFrame(frame, opts, ctx);
      const hosts = leafValues(root, 'host');

      expect(hosts).toEqual([['a', 'b', 'c']]);
    });

    it('applies value sort when no groups configured', () => {
      const frame = indexFrame(
        makeFrame([
          makeField('host', FieldType.string, ['c', 'a', 'b']),
          makeField('value', FieldType.number, [3, 1, 2]),
        ])
      );
      const opts = makeOptions({
        idField: 'host',
        idSortMode: SortMode.Lexicographic,
      });
      const root = groupFrame(frame, opts, ctx);

      expect([...root.frame.fieldByName.get('host')!.values]).toEqual(['a', 'b', 'c']);
      expect([...root.frame.fieldByName.get('value')!.values]).toEqual([1, 2, 3]);
    });

    it('does not reorder when idField is not set', () => {
      const frame = indexFrame(makeFrame([makeField('host', FieldType.string, ['c', 'a', 'b'])]));
      const opts = makeOptions();
      const root = groupFrame(frame, opts, ctx);

      expect([...root.frame.fieldByName.get('host')!.values]).toEqual(['c', 'a', 'b']);
    });
  });

  // -- GroupNode properties ---------------------------------------------------

  describe('GroupNode properties', () => {
    it('propagates group config to children', () => {
      const frame = indexFrame(
        makeFrame([
          makeField('dc', FieldType.string, ['us', 'eu']),
          makeField('v', FieldType.number, [1, 2]),
        ])
      );
      const opts = makeOptions({
        groups: [
          makeGroup({
            groupKey: 'dc',
            showTitle: true,
            showKeyName: true,
            titlePattern: '${dc}',
            drawBorder: true,
            borderColor: '#ff0000',
            transparentBackground: false,
          }),
        ],
      });
      const root = groupFrame(frame, opts, ctx);

      for (const child of root.children) {
        expect(child.showTitle).toBe(true);
        expect(child.showKeyName).toBe(true);
        expect(child.titlePattern).toBe('${dc}');
        expect(child.drawBorder).toBe(true);
        expect(child.borderColor).toBe('#ff0000');
        expect(child.transparentBackground).toBe(false);
      }
    });

    it('root node uses first active group grid settings', () => {
      const frame = indexFrame(
        makeFrame([
          makeField('dc', FieldType.string, ['us']),
          makeField('v', FieldType.number, [1]),
        ])
      );
      const opts = makeOptions({
        gridType: GridType.Flow,
        gridColumns: 4,
        groups: [makeGroup({ groupKey: 'dc', gridType: GridType.Grid, gridColumns: 6 })],
      });
      const root = groupFrame(frame, opts, ctx);

      expect(root.gridType).toBe(GridType.Grid);
      expect(root.gridColumns).toBe(6);
    });

    it('root node uses panel-level grid settings when no groups', () => {
      const frame = indexFrame(makeFrame([makeField('v', FieldType.number, [1])]));
      const opts = makeOptions({
        gridType: GridType.Horizontal,
        gridColumns: 3,
      });
      const root = groupFrame(frame, opts, ctx);

      expect(root.gridType).toBe(GridType.Horizontal);
      expect(root.gridColumns).toBe(3);
    });

    it('children use next group grid settings or panel defaults', () => {
      const frame = indexFrame(
        makeFrame([
          makeField('dc', FieldType.string, ['us']),
          makeField('rack', FieldType.string, ['r1']),
          makeField('v', FieldType.number, [1]),
        ])
      );
      const opts = makeOptions({
        gridType: GridType.Vertical,
        gridColumns: 5,
        groups: [
          makeGroup({ groupKey: 'dc', gridType: GridType.Grid, gridColumns: 6 }),
          makeGroup({ groupKey: 'rack', gridType: GridType.Horizontal, gridColumns: 2 }),
        ],
      });
      const root = groupFrame(frame, opts, ctx);

      // Root uses first group's settings
      expect(root.gridType).toBe(GridType.Grid);
      // dc children use rack's settings
      expect(root.children[0].gridType).toBe(GridType.Horizontal);
      // rack children (leaf) use panel defaults
      expect(root.children[0].children[0].gridType).toBe(GridType.Vertical);
    });
  });

  // -- edge cases -------------------------------------------------------------

  describe('edge cases', () => {
    it('handles empty frame', () => {
      const frame = indexFrame(makeFrame([]));
      const opts = makeOptions({
        groups: [makeGroup({ groupKey: 'dc' })],
      });
      const root = groupFrame(frame, opts, ctx);

      // Missing field creates a passthrough node
      expect(root.children).toHaveLength(1);
      expect(root.children[0].children).toHaveLength(0);
      expect(root.children[0].frame.length).toBe(0);
    });

    it('handles frame with zero rows', () => {
      const frame = indexFrame(makeFrame([makeField('dc', FieldType.string, [])]));
      const opts = makeOptions({
        groups: [makeGroup({ groupKey: 'dc' })],
      });
      const root = groupFrame(frame, opts, ctx);

      expect(root.children).toHaveLength(0);
    });
  });
});
