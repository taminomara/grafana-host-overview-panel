import { test, expect } from '@grafana/plugin-e2e';

const E2E_DASHBOARD = 'e2e-tests.json';

// ── Data Anomalies ──

test.describe('data anomalies', () => {
  test('empty frame renders without crash', async ({
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '11' });
    await expect(panelEditPage.panel.locator).not.toContainText('No data');
    await expect(panelEditPage.panel.locator).not.toContainText('Cannot visualize data');
  });

  test('duplicate frame IDs shows error', async ({
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '12' });
    await expect(panelEditPage.panel.locator).toContainText('Duplicate data frame IDs');
  });

  test('missing status field renders without crash', async ({
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '13' });
    for (const name of ['node-a', 'node-b', 'node-c', 'node-d', 'node-e']) {
      await expect(panelEditPage.panel.locator).toContainText(name);
    }
  });

  test('missing group field renders all resources', async ({
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '14' });
    for (const name of ['node-a', 'node-b', 'node-c', 'node-d', 'node-e']) {
      await expect(panelEditPage.panel.locator).toContainText(name);
    }
  });

  test('null/empty values render with placeholder', async ({
    page,
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '15' });
    const panel = panelEditPage.panel.locator;
    for (const name of ['node-a', 'node-b', 'node-c', 'node-d', 'node-e']) {
      await expect(panel).toContainText(name);
    }

    // Thresholds: status=0 → #ff0000, status=1 → #00ff00
    // Null mapping: null/NaN → "Unknown" with color #888888
    // Data: node-a(s=1), node-b(s=null), node-c(s=1), node-d(s=1), node-e(s=0)
    const cells = panel.locator('div[style*="linear-gradient"]');
    await expect(cells).toHaveCount(5);
    const colorCounts = await cells.evaluateAll((els) => {
      const bgs = els.map((el) => getComputedStyle(el).backgroundImage);
      return {
        green: bgs.filter((b) => b.includes('rgb(0, 255, 0)')).length,
        red: bgs.filter((b) => b.includes('rgb(255, 0, 0)')).length,
        gray: bgs.filter((b) => b.includes('rgb(136, 136, 136)')).length,
      };
    });
    expect(colorCounts.green).toBe(3); // node-a, node-c, node-d
    expect(colorCounts.red).toBe(1); // node-e
    expect(colorCounts.gray).toBe(1); // node-b (null status → mapping color)

    // Open tooltip for node-b (null status and cpu) and verify mapped values
    const nodeBCell = panel.locator('[data-testid="resource-cell"]').filter({ hasText: 'node-b' });
    await nodeBCell.click();
    const tooltip = page.locator('[data-testid="resource-tooltip"]');
    // status is always rendered; cpu is from displayEntries
    await expect(tooltip).toContainText('status');
    await expect(tooltip).toContainText('cpu');
    // Null values should display mapped text "Unknown" in gray (#888888)
    const unknownSpans = tooltip.locator('span[style*="color"]');
    const unknownColors = await unknownSpans.evaluateAll((els) =>
      els.filter((el) => el.textContent === 'Unknown').map((el) => el.style.color)
    );
    expect(unknownColors).toHaveLength(2); // status + cpu
    for (const c of unknownColors) {
      expect(c).toContain('rgb(136, 136, 136)');
    }
  });

  test('single row renders one resource', async ({
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '16' });
    await expect(panelEditPage.panel.locator).toContainText('node-a');
  });

  test('wrong data frame shows error', async ({ gotoPanelEditPage, readProvisionedDashboard }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '17' });
    await expect(panelEditPage.panel.locator).toContainText('Data frame not found');
    await expect(panelEditPage.panel.locator).toContainText('NonexistentFrame');
  });
});

// ── Display Modes ──

test.describe('display modes', () => {
  test('cell mode renders colored squares', async ({
    page,
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '20' });
    const panel = panelEditPage.panel.locator;
    await expect(panel).not.toContainText('No data');
    await expect(panel).not.toContainText('node-a');

    // Thresholds: status=0 → #ff0000, status=1 → #00ff00
    // Data: node-a(1), node-b(0), node-c(1), node-d(1), node-e(0)
    const cells = panel.locator('div[style*="linear-gradient"]');
    await expect(cells).toHaveCount(5);
    const colorCounts = await cells.evaluateAll((els) => {
      const bgs = els.map((el) => getComputedStyle(el).backgroundImage);
      return {
        green: bgs.filter((b) => b.includes('rgb(0, 255, 0)')).length,
        red: bgs.filter((b) => b.includes('rgb(255, 0, 0)')).length,
      };
    });
    expect(colorCounts.green).toBe(3);
    expect(colorCounts.red).toBe(2);

    // Click a cell to open its tooltip
    await panel.locator('[data-testid="resource-cell"]').first().click();
    const tooltip = page.locator('[data-testid="resource-tooltip"]');
    await expect(tooltip).toContainText('status');
  });

  test('cell with text shows resource names', async ({
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '21' });
    const panel = panelEditPage.panel.locator;
    for (const name of ['node-a', 'node-b', 'node-c', 'node-d', 'node-e']) {
      await expect(panel).toContainText(name);
    }

    // Thresholds: status=0 → #ff0000, status=1 → #00ff00
    // Data: node-a(1), node-b(0), node-c(1), node-d(1), node-e(0)
    const cells = panel.locator('div[style*="linear-gradient"]');
    await expect(cells).toHaveCount(5);
    const colorCounts = await cells.evaluateAll((els) => {
      const bgs = els.map((el) => getComputedStyle(el).backgroundImage);
      return {
        green: bgs.filter((b) => b.includes('rgb(0, 255, 0)')).length,
        red: bgs.filter((b) => b.includes('rgb(255, 0, 0)')).length,
      };
    });
    expect(colorCounts.green).toBe(3);
    expect(colorCounts.red).toBe(2);
  });

  test('rich table shows field labels and values', async ({
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '22' });
    const panel = panelEditPage.panel.locator;
    await expect(panel).toContainText('role');
    await expect(panel).toContainText('cpu');
    await expect(panel).toContainText('web');
    await expect(panel).toContainText('db');
    await expect(panel).toContainText('45');
    await expect(panel).toContainText('82');
    await expect(panel).toContainText('91');

    // Card border color from status: #ff0000@0, #00ff00@1
    // Data: node-a(1), node-b(0), node-c(1), node-d(1), node-e(0)
    const cards = panel.locator('div[style*="border-color"]');
    await expect(cards).toHaveCount(5);
    const borderCounts = await cards.evaluateAll((els) => {
      const colors = els.map((el) => el.style.borderColor);
      return {
        green: colors.filter((c) => c.includes('rgb(0, 255, 0)')).length,
        red: colors.filter((c) => c.includes('rgb(255, 0, 0)')).length,
      };
    });
    expect(borderCounts.green).toBe(3);
    expect(borderCounts.red).toBe(2);

    // CPU value text colored by cpu thresholds: #00aa00@0, #aaaa00@50, #aa0000@80
    // cpu: 45→rgb(0,170,0), 23→rgb(0,170,0), 67→rgb(170,170,0), 82→rgb(170,0,0), 91→rgb(170,0,0)
    const cpuValues = panel.locator('span[style*="color"]');
    const cpuColorCounts = await cpuValues.evaluateAll((els) => {
      const colors = els.map((el) => el.style.color);
      return {
        green: colors.filter((c) => c.includes('rgb(0, 170, 0)')).length,
        yellow: colors.filter((c) => c.includes('rgb(170, 170, 0)')).length,
        red: colors.filter((c) => c.includes('rgb(170, 0, 0)')).length,
      };
    });
    expect(cpuColorCounts.green).toBe(2); // cpu 45, 23
    expect(cpuColorCounts.yellow).toBe(1); // cpu 67
    expect(cpuColorCounts.red).toBe(2); // cpu 82, 91
  });

  test('rich table with expandable tooltip has show more button', async ({
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '23' });
    const panel = panelEditPage.panel.locator;
    // Rich entries show role directly
    await expect(panel).toContainText('role');
    await expect(panel).toContainText('web');
    await expect(panel).toContainText('db');
    // Tooltip entries (cpu) are hidden behind "show more"
    const showMore = panel.getByText('show more').first();
    await expect(showMore).toBeVisible();
    // CPU values should not be visible until expanded
    const tooltipRegion = panel.locator('[role="region"][aria-hidden="true"]').first();
    await expect(tooltipRegion).toHaveCount(1);
  });
});

// ── Grouping ──

test.describe('grouping', () => {
  test('no groups shows flat list', async ({ gotoPanelEditPage, readProvisionedDashboard }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '30' });
    for (const name of ['srv-1', 'srv-2', 'srv-3', 'srv-4', 'srv-5', 'srv-6']) {
      await expect(panelEditPage.panel.locator).toContainText(name);
    }
    // Without groups, region labels should not appear as headings
    await expect(panelEditPage.panel.locator).not.toContainText('us-east');
    await expect(panelEditPage.panel.locator).not.toContainText('eu-west');
  });

  test('single group shows group titles', async ({
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '31' });
    await expect(panelEditPage.panel.locator).toContainText('us-east');
    await expect(panelEditPage.panel.locator).toContainText('eu-west');
    // All resources should still be visible
    for (const name of ['srv-1', 'srv-2', 'srv-3', 'srv-4', 'srv-5', 'srv-6']) {
      await expect(panelEditPage.panel.locator).toContainText(name);
    }
  });

  test('multiple groups shows nested hierarchy', async ({
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '32' });
    // Both group levels should be visible
    await expect(panelEditPage.panel.locator).toContainText('us-east');
    await expect(panelEditPage.panel.locator).toContainText('eu-west');
    await expect(panelEditPage.panel.locator).toContainText('web');
    await expect(panelEditPage.panel.locator).toContainText('db');
    await expect(panelEditPage.panel.locator).toContainText('api');
    // Resources should also be visible
    await expect(panelEditPage.panel.locator).toContainText('srv-1');
    await expect(panelEditPage.panel.locator).toContainText('srv-6');
  });

  test('disabled group is skipped', async ({ gotoPanelEditPage, readProvisionedDashboard }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '33' });
    // Only role group applied
    await expect(panelEditPage.panel.locator).toContainText('web');
    await expect(panelEditPage.panel.locator).toContainText('db');
    await expect(panelEditPage.panel.locator).toContainText('api');
    // Region titles should not appear as group headings
    await expect(panelEditPage.panel.locator).not.toContainText('us-east');
    await expect(panelEditPage.panel.locator).not.toContainText('eu-west');
    // All resources still rendered
    for (const name of ['srv-1', 'srv-2', 'srv-3', 'srv-4', 'srv-5', 'srv-6']) {
      await expect(panelEditPage.panel.locator).toContainText(name);
    }
  });

  test('group with missing field renders all resources', async ({
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '34' });
    for (const name of ['srv-1', 'srv-2', 'srv-3', 'srv-4', 'srv-5', 'srv-6']) {
      await expect(panelEditPage.panel.locator).toContainText(name);
    }
  });
});

// ── Sorting ──

test.describe('sorting', () => {
  test('default sort renders all items', async ({
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '40' });
    for (const name of ['node-1', 'node-10', 'node-2', 'node-3']) {
      await expect(panelEditPage.panel.locator).toContainText(name);
    }
  });

  test('lexicographic sort orders strings', async ({
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '41' });
    await expect(panelEditPage.panel.locator).toContainText('node-1');
    const text = await panelEditPage.panel.locator.textContent();
    const matches = [...(text?.matchAll(/node-\d+/g) ?? [])].map((m) => m[0]);
    expect(matches).toEqual(['node-1', 'node-10', 'node-2', 'node-3']);
  });

  test('numeric sort orders by number', async ({ gotoPanelEditPage, readProvisionedDashboard }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '42' });
    const panel = panelEditPage.panel.locator;
    // Data: 3, 1, 10, 2 → numeric sort → 1, 2, 3, 10
    await expect(panel).toContainText('10');
    const cellTexts = await panel
      .locator('[data-testid="resource-cell"]')
      .evaluateAll((els) => els.map((el) => el.textContent?.trim()));
    expect(cellTexts).toEqual(['1', '2', '3', '10']);
  });

  test('custom sort extracts numeric groups', async ({
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '43' });
    await expect(panelEditPage.panel.locator).toContainText('node-1');
    const text = await panelEditPage.panel.locator.textContent();
    const matches = [...(text?.matchAll(/node-\d+/g) ?? [])].map((m) => m[0]);
    expect(matches).toEqual(['node-1', 'node-2', 'node-3', 'node-10']);
  });

  test('group lexicographic sort orders groups alphabetically', async ({
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '44' });
    await expect(panelEditPage.panel.locator).toContainText('eu-west');
    const text = await panelEditPage.panel.locator.textContent();
    const euIdx = text?.indexOf('eu-west') ?? -1;
    const usIdx = text?.indexOf('us-east') ?? -1;
    expect(euIdx).toBeGreaterThan(-1);
    expect(usIdx).toBeGreaterThan(-1);
    expect(euIdx).toBeLessThan(usIdx);
    // Resources should still be visible
    await expect(panelEditPage.panel.locator).toContainText('srv-1');
    await expect(panelEditPage.panel.locator).toContainText('srv-6');
  });

  test('group numeric sort orders groups by number', async ({
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '45' });
    const panel = panelEditPage.panel.locator;
    // Groups by zone: 1, 2, 3, 10 (numeric order, not 1, 10, 2, 3)
    await expect(panel).toContainText('10');
    const text = await panel.textContent();
    // Group titles appear in text; extract positions and verify numeric order
    // Use word boundary-like matching: zone values are standalone in group headings
    const zones = ['1', '2', '3', '10'];
    const positions = zones.map((z) => {
      const re = new RegExp(`(?<![\\d])${z}(?![\\d])`);
      const m = re.exec(text ?? '');
      return { zone: z, idx: m?.index ?? -1 };
    });
    for (const { zone, idx } of positions) {
      expect(idx, `zone "${zone}" should be found`).toBeGreaterThan(-1);
    }
    for (let i = 0; i < positions.length - 1; i++) {
      expect(
        positions[i].idx,
        `zone "${positions[i].zone}" before "${positions[i + 1].zone}"`
      ).toBeLessThan(positions[i + 1].idx);
    }
  });
});

// ── Layout ──

test.describe('layout', () => {
  test('flow layout renders resources', async ({ gotoPanelEditPage, readProvisionedDashboard }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '50' });
    for (const name of ['node-a', 'node-b', 'node-c', 'node-d', 'node-e']) {
      await expect(panelEditPage.panel.locator).toContainText(name);
    }
  });

  test('grid layout renders resources', async ({ gotoPanelEditPage, readProvisionedDashboard }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '51' });
    for (const name of ['node-a', 'node-b', 'node-c', 'node-d', 'node-e']) {
      await expect(panelEditPage.panel.locator).toContainText(name);
    }
  });

  test('horizontal layout renders resources', async ({
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '52' });
    for (const name of ['node-a', 'node-b', 'node-c', 'node-d', 'node-e']) {
      await expect(panelEditPage.panel.locator).toContainText(name);
    }
  });

  test('vertical layout renders resources', async ({
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '53' });
    for (const name of ['node-a', 'node-b', 'node-c', 'node-d', 'node-e']) {
      await expect(panelEditPage.panel.locator).toContainText(name);
    }
  });
});

// ── Group Visual Settings ──

test.describe('group settings', () => {
  test('hidden title does not show group values', async ({
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '60' });
    // Resources visible but group titles suppressed
    for (const name of ['srv-1', 'srv-2', 'srv-3', 'srv-4', 'srv-5', 'srv-6']) {
      await expect(panelEditPage.panel.locator).toContainText(name);
    }
    await expect(panelEditPage.panel.locator).not.toContainText('us-east');
    await expect(panelEditPage.panel.locator).not.toContainText('eu-west');
  });

  test('field name in title shows key name', async ({
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '61' });
    // With showKeyName=true, titles should include the field name "region"
    await expect(panelEditPage.panel.locator).toContainText('region');
    await expect(panelEditPage.panel.locator).toContainText('us-east');
    await expect(panelEditPage.panel.locator).toContainText('eu-west');
  });

  test('title pattern renders interpolated title', async ({
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '62' });
    // The titlePattern is "Region: ${__data.fields.region}"
    await expect(panelEditPage.panel.locator).toContainText('Region:');
    // Both region values should appear in interpolated titles
    await expect(panelEditPage.panel.locator).toContainText('us-east');
    await expect(panelEditPage.panel.locator).toContainText('eu-west');
  });

  test('hidden border has no border-color style', async ({
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '63' });
    const panel = panelEditPage.panel.locator;
    await expect(panel).toContainText('us-east');
    await expect(panel).toContainText('eu-west');
    // drawBorder=false → no inline border-color on any group container
    const borderedDivs = panel.locator('div[style*="border-color"]');
    await expect(borderedDivs).toHaveCount(0);
  });

  test('group-level border color overrides default', async ({
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '64' });
    const panel = panelEditPage.panel.locator;
    await expect(panel).toContainText('us-east');
    // Group borderColor: #aa00aa → rgb(170, 0, 170)
    const groups = panel.locator('div[style*="border-color"]');
    await expect(groups).toHaveCount(2);
    const colors = await groups.evaluateAll((els) => els.map((el) => el.style.borderColor));
    expect(colors.every((c) => c.includes('rgb(170, 0, 170)'))).toBe(true);
  });

  test('panel-level border color applies to groups without override', async ({
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '65' });
    const panel = panelEditPage.panel.locator;
    await expect(panel).toContainText('us-east');
    // Panel borderColor: #00aaaa → rgb(0, 170, 170), group has no own borderColor
    const groups = panel.locator('div[style*="border-color"]');
    await expect(groups).toHaveCount(2);
    const colors = await groups.evaluateAll((els) => els.map((el) => el.style.borderColor));
    expect(colors.every((c) => c.includes('rgb(0, 170, 170)'))).toBe(true);
  });

  test('transparent background makes group background transparent', async ({
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '65' });
    const panel = panelEditPage.panel.locator;
    await expect(panel).toContainText('us-east');
    // transparentBackground: true → backgroundColor should be 'transparent' or 'rgba(0, 0, 0, 0)'
    const groups = panel.locator('div[style*="border-color"]');
    await expect(groups).toHaveCount(2);
    const bgs = await groups.evaluateAll((els) =>
      els.map((el) => getComputedStyle(el).backgroundColor)
    );
    expect(bgs.every((bg) => bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)')).toBe(true);
  });
});

// ── Tooltips and Field Display ──

test.describe('tooltips and fields', () => {
  test('cell tooltip shows configured fields', async ({
    page,
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '70' });
    await expect(panelEditPage.panel.locator).not.toContainText('No data');
    // Click a cell to open its tooltip
    await panelEditPage.panel.locator.locator('[data-testid="resource-cell"]').first().click();
    const tooltip = page.locator('[data-testid="resource-tooltip"]');
    await expect(tooltip).toContainText('role');
    await expect(tooltip).toContainText('cpu');
    // Should show actual field values from the first row
    await expect(
      tooltip.getByText('web').or(tooltip.getByText('db')).or(tooltip.getByText('api')).first()
    ).toBeVisible();
  });

  test('tooltip title override renders pattern', async ({
    page,
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '71' });
    await expect(panelEditPage.panel.locator).not.toContainText('No data');
    // Click a cell to open its tooltip
    await panelEditPage.panel.locator.locator('[data-testid="resource-cell"]').first().click();
    const tooltip = page.locator('[data-testid="resource-tooltip"]');
    // Title should be "Host: <name>" from the pattern "Host: ${__data.fields.name}"
    await expect(tooltip.getByText(/Host:/).first()).toBeVisible();
    // Tooltip entry (role) should also be visible
    await expect(tooltip).toContainText('role');
  });

  test('value mappings show mapped text', async ({
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '72' });
    // Rich table with status field mapped: 0 → "Down", 1 → "Up"
    await expect(panelEditPage.panel.locator).toContainText('Up');
    await expect(panelEditPage.panel.locator).toContainText('Down');
    // The label "status" should appear for each row
    await expect(panelEditPage.panel.locator).toContainText('status');
  });

  test('thresholds apply color-coded values', async ({
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '73' });
    const panel = panelEditPage.panel.locator;
    // Rich table with cpu field and thresholds: #00aa00@0, #aaaa00@50, #aa0000@80
    // CPU values: 45, 82, 23, 67, 91
    await expect(panel).toContainText('cpu');
    await expect(panel).toContainText('45');
    await expect(panel).toContainText('91');

    // Card border color comes from status: #ff0000@0, #00ff00@1
    // Data: node-a(1), node-b(0), node-c(1), node-d(1), node-e(0)
    // Cards are divs with inline border-color
    const cards = panel.locator('div[style*="border-color"]');
    await expect(cards).toHaveCount(5);
    const borderCounts = await cards.evaluateAll((els) => {
      const colors = els.map((el) => el.style.borderColor);
      return {
        green: colors.filter((c) => c.includes('rgb(0, 255, 0)')).length,
        red: colors.filter((c) => c.includes('rgb(255, 0, 0)')).length,
      };
    });
    expect(borderCounts.green).toBe(3);
    expect(borderCounts.red).toBe(2);

    // CPU value text should be colored by cpu thresholds
    // cpu=45 → #00aa00 → rgb(0, 170, 0), cpu=67 → #aaaa00 → rgb(170, 170, 0),
    // cpu=82 → #aa0000 → rgb(170, 0, 0)
    const cpuValues = panel.locator('span[style*="color"]');
    const cpuColorCounts = await cpuValues.evaluateAll((els) => {
      const colors = els.map((el) => el.style.color);
      return {
        green: colors.filter((c) => c.includes('rgb(0, 170, 0)')).length,
        yellow: colors.filter((c) => c.includes('rgb(170, 170, 0)')).length,
        red: colors.filter((c) => c.includes('rgb(170, 0, 0)')).length,
      };
    });
    expect(cpuColorCounts.green).toBe(2); // cpu 45, 23
    expect(cpuColorCounts.yellow).toBe(1); // cpu 67
    expect(cpuColorCounts.red).toBe(2); // cpu 82, 91
  });

  test('rich table expandable tooltip expands and collapses', async ({
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '74' });
    const panel = panelEditPage.panel.locator;

    // Rich entries (role) should be visible in the card
    await expect(panel).toContainText('role');
    await expect(panel).toContainText('web');

    // "show more" button should be present (tooltip entries exist)
    const showMore = panel.getByText('show more').first();
    await expect(showMore).toBeVisible();

    // Before expanding, tooltip region should be hidden
    await expect(panel.locator('[role="region"][aria-hidden="true"]').first()).toHaveCount(1);

    // Expand the first card
    await showMore.click();
    await expect(panel.getByText('show less').first()).toBeVisible();

    // The expanded region should become visible and contain cpu data
    const expandedRegion = panel.locator('[role="region"][aria-hidden="false"]').first();
    await expect(expandedRegion).toBeVisible();
    await expect(expandedRegion).toContainText('cpu');

    // Collapse again
    await panel.getByText('show less').first().click();
    await expect(panel.getByText('show more').first()).toBeVisible();
  });
});

// ── Joins ──

test.describe('joins', () => {
  test('basic join shows joined values', async ({
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '80' });
    // Rich table with join from Secondary frame: node-a → 8192, node-b → 16384, node-c → 4096
    await expect(panelEditPage.panel.locator).toContainText('memory');
    await expect(panelEditPage.panel.locator).toContainText('8192');
    await expect(panelEditPage.panel.locator).toContainText('16384');
    await expect(panelEditPage.panel.locator).toContainText('4096');
    // Resource names should also be present
    await expect(panelEditPage.panel.locator).toContainText('node-a');
    await expect(panelEditPage.panel.locator).toContainText('node-b');
    await expect(panelEditPage.panel.locator).toContainText('node-c');
  });

  test('join with no matches renders gracefully', async ({
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '81' });
    await expect(panelEditPage.panel.locator).not.toContainText('No data');
    // No matching keys → joined values should not appear
    await expect(panelEditPage.panel.locator).not.toContainText('8192');
    await expect(panelEditPage.panel.locator).not.toContainText('16384');
    // But resources should still render
    await expect(panelEditPage.panel.locator).toContainText('node-a');
    await expect(panelEditPage.panel.locator).toContainText('node-e');
  });

  test('missing join frame renders gracefully', async ({
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '82' });
    await expect(panelEditPage.panel.locator).not.toContainText('No data');
    // Resources should still render even if join frame doesn't exist
    await expect(panelEditPage.panel.locator).toContainText('node-a');
    await expect(panelEditPage.panel.locator).toContainText('node-e');
  });

  test('status from join colors cells correctly', async ({
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '130' });
    const panel = panelEditPage.panel.locator;
    await expect(panel).not.toContainText('No data');

    // Thresholds: status=0 → #ff0000, status=1 → #00ff00
    // Status comes from StatusFrame via join on name
    // Data: node-a(1), node-b(0), node-c(1), node-d(1), node-e(0)
    const cells = panel.locator('div[style*="linear-gradient"]');
    await expect(cells).toHaveCount(5);
    const colorCounts = await cells.evaluateAll((els) => {
      const bgs = els.map((el) => getComputedStyle(el).backgroundImage);
      return {
        green: bgs.filter((b) => b.includes('rgb(0, 255, 0)')).length,
        red: bgs.filter((b) => b.includes('rgb(255, 0, 0)')).length,
      };
    });
    expect(colorCounts.green).toBe(3);
    expect(colorCounts.red).toBe(2);
  });
});

// ── Sidecar ──

test.describe('sidecar', () => {
  test('sidecar cells have thick border and appear after non-sidecars', async ({
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '140' });
    const panel = panelEditPage.panel.locator;
    await expect(panel).not.toContainText('No data');

    // Data: node-a(s=1,sc=false), node-b(s=1,sc=true), node-c(s=0,sc=false),
    //       node-d(s=1,sc=yes), node-e(s=0,sc=false)
    // Lexicographic sort: node-a, node-b, node-c, node-d, node-e
    // After sidecar partition: non-sidecars first, sidecars last
    // Non-sidecars: node-a, node-c, node-e  Sidecars: node-b, node-d
    const cells = panel.locator('[data-testid="resource-cell"]');
    await expect(cells).toHaveCount(5);

    const cellTexts = await cells.evaluateAll((els) =>
      els.map((el) => el.textContent?.trim())
    );
    expect(cellTexts).toEqual(['node-a', 'node-c', 'node-e', 'node-b', 'node-d']);

    // Sidecar cells (last two) have padding (wrapper div); non-sidecar cells do not
    const paddings = await cells.evaluateAll((els) =>
      els.map((el) => {
        const inner = el.querySelector('div');
        return parseInt(getComputedStyle(inner!).paddingTop, 10);
      })
    );
    expect(paddings[0]).toBe(0); // node-a: not sidecar
    expect(paddings[1]).toBe(0); // node-c: not sidecar
    expect(paddings[2]).toBe(0); // node-e: not sidecar
    expect(paddings[3]).toBeGreaterThanOrEqual(2); // node-b: sidecar
    expect(paddings[4]).toBeGreaterThanOrEqual(2); // node-d: sidecar
  });
});

// ── Known IDs ──

test.describe('known IDs', () => {
  test('known IDs appear even without data', async ({
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '90' });
    // node-a exists in data and in knownIds
    await expect(panelEditPage.panel.locator).toContainText('node-a');
    // node-x and node-y are in knownIds but not in data → should appear as placeholders
    await expect(panelEditPage.panel.locator).toContainText('node-x');
    await expect(panelEditPage.panel.locator).toContainText('node-y');
    // Real data resources should also be present
    await expect(panelEditPage.panel.locator).toContainText('node-b');
    await expect(panelEditPage.panel.locator).toContainText('node-e');
  });

  test('known IDs in groups create full matrix', async ({
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '91' });
    const panel = panelEditPage.panel.locator;
    // Data: node-a(us-east/web), node-b(eu-west/db)
    // Group knownIds: region=[us-east,eu-west,ap-south], role=[web,db,api]
    // Resource knownIds: [node-a,node-b,node-x]
    // → full matrix: 3 regions × 3 roles = 9 leaf groups, each with 3 resources = 27 cells

    // Known group values with no data still appear
    await expect(panel).toContainText('api');
    await expect(panel).toContainText('web');
    await expect(panel).toContainText('db');
    // Known resource ID with no data still appears
    await expect(panel).toContainText('node-x');
    // All 3 regions visible
    await expect(panel).toContainText('us-east');
    await expect(panel).toContainText('eu-west');
    await expect(panel).toContainText('ap-south');
    // Full matrix: 3×3×3 = 27 resource cells
    const cells = panel.locator('[data-testid="resource-cell"]');
    await expect(cells).toHaveCount(27);
  });

  test('known IDs from cross-join appear even without data', async ({
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '92' });
    const panel = panelEditPage.panel.locator;
    // Data: node-a, node-b
    // knownIdsJoin from frame B: node-a, node-b, node-c, node-x
    await expect(panel).toContainText('node-a');
    await expect(panel).toContainText('node-b');
    await expect(panel).toContainText('node-c');
    await expect(panel).toContainText('node-x');
    const cells = panel.locator('[data-testid="resource-cell"]');
    await expect(cells).toHaveCount(4);
  });

  test('known IDs from keyed join in groups', async ({
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '93' });
    const panel = panelEditPage.panel.locator;
    // Data: node-a(us), node-b(eu)
    // Groups: dc with knownIds us,eu,ap
    // knownIdsJoin from frame B keyed by dc=region: us→[node-a,node-c], eu→[node-b,node-d], ap→[node-x]
    await expect(panel).toContainText('us');
    await expect(panel).toContainText('eu');
    await expect(panel).toContainText('ap');
    // node-c appears via join for us group
    await expect(panel).toContainText('node-c');
    // node-d appears via join for eu group
    await expect(panel).toContainText('node-d');
    // node-x appears via join for ap group
    await expect(panel).toContainText('node-x');
  });
});

// ── Cell Size ──

test.describe('cell size', () => {
  test('small cells render with correct size', async ({
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '100' });
    await expect(panelEditPage.panel.locator).not.toContainText('No data');
    // Small cells (10px) - find the actual cell element by its background style
    const cells = panelEditPage.panel.locator.locator('div[style*="linear-gradient"]');
    await expect(cells.first()).toBeVisible();
    const count = await cells.count();
    expect(count).toBe(5);
    const box = await cells.first().boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeLessThanOrEqual(15);
    expect(box!.height).toBeLessThanOrEqual(15);
  });

  test('large cells render with correct size', async ({
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '101' });
    await expect(panelEditPage.panel.locator).not.toContainText('No data');
    // Large cells (40px) - find the actual cell element by its background style
    const cells = panelEditPage.panel.locator.locator('div[style*="linear-gradient"]');
    await expect(cells.first()).toBeVisible();
    const count = await cells.count();
    expect(count).toBe(5);
    const box = await cells.first().boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(35);
    expect(box!.height).toBeGreaterThanOrEqual(35);
  });
});

// ── Criticality ──

test.describe('criticality', () => {
  test('cell mode criticality override colors cells', async ({
    page,
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '110' });
    const panel = panelEditPage.panel.locator;
    await expect(panel).not.toContainText('No data');

    // Cell color from status: #ff0000@0, #00ff00@1
    // Override color from cpu: #00aa00@0, #aaaa00@50, #aa0000@80
    // Data: node-a(s=1,cpu=45), node-b(s=0,cpu=82), node-c(s=1,cpu=23),
    //       node-d(s=1,cpu=67), node-e(s=0,cpu=91)
    // Gradient: linear-gradient(... cellColor ... overrideColor ...)
    const cells = panel.locator('div[style*="linear-gradient"]');
    await expect(cells).toHaveCount(5);
    const gradients = await cells.evaluateAll((els) =>
      els.map((el) => getComputedStyle(el).backgroundImage)
    );
    // Distance-based scoring: no named green → l=0, maxDist=2
    // cpu=45,23 → #00aa00 (i=0), score 0 → no override
    // cpu=67 → #aaaa00 (i=1), score 0.5 → override rgb(170, 170, 0)
    // cpu=82,91 → #aa0000 (i=2), score 1 → override rgb(170, 0, 0)
    const withCpuYellow = gradients.filter((g) => g.includes('rgb(170, 170, 0)')).length;
    const withCpuRed = gradients.filter((g) => g.includes('rgb(170, 0, 0)')).length;
    expect(withCpuYellow).toBe(1); // cpu 67
    expect(withCpuRed).toBe(2); // cpu 82, 91
    // node-d has status=1→rgb(0,255,0) and cpu=67→rgb(170,170,0): two distinct colors
    const splitCell = gradients.find(
      (g) => g.includes('rgb(0, 255, 0)') && g.includes('rgb(170, 170, 0)')
    );
    expect(splitCell).toBeDefined();

    // Click a cell to open its tooltip
    await panel.locator('[data-testid="resource-cell"]').first().click();
    const tooltip = page.locator('[data-testid="resource-tooltip"]');
    await expect(tooltip).toContainText('cpu');
  });

  test('rich table criticality override colors card borders', async ({
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '111' });
    const panel = panelEditPage.panel.locator;
    await expect(panel).toContainText('node-a');

    // CPU override: #00aa00@0, #aaaa00@50, #aa0000@80
    // Distance-based scoring: no named green → l=0, maxDist=2
    // node-a(s=1,cpu=45): score 0 → no override → status rgb(0, 255, 0)
    // node-b(s=0,cpu=82): score 1 → override rgb(170, 0, 0)
    // node-c(s=1,cpu=23): score 0 → no override → status rgb(0, 255, 0)
    // node-d(s=1,cpu=67): score 0.5 → override rgb(170, 170, 0)
    // node-e(s=0,cpu=91): score 1 → override rgb(170, 0, 0)
    const cards = panel.locator('div[style*="border-color"]');
    await expect(cards).toHaveCount(5);
    const borderColors = await cards.evaluateAll((els) => els.map((el) => el.style.borderColor));
    const green = borderColors.filter((c) => c.includes('rgb(0, 255, 0)')).length;
    const yellow = borderColors.filter((c) => c.includes('rgb(170, 170, 0)')).length;
    const red = borderColors.filter((c) => c.includes('rgb(170, 0, 0)')).length;
    expect(green).toBe(2); // node-a, node-c
    expect(yellow).toBe(1); // node-d
    expect(red).toBe(2); // node-b, node-e
  });

  test('group criticality override colors group borders', async ({
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '112' });
    const panel = panelEditPage.panel.locator;
    await expect(panel).toContainText('web');

    // Groups by role: web, db, api. Group entries has cpu with overridesBorderColor.
    // Distance-based scoring: no named green → l=0, maxDist=2
    // web → first row cpu=82 → score 1 → rgb(170, 0, 0)
    // db  → first row cpu=67 → score 0.5 → rgb(170, 170, 0)
    // api → first row cpu=91 → score 1 → rgb(170, 0, 0)
    const groups = panel.locator('div[style*="border-color"]');
    await expect(groups).toHaveCount(3);
    const borderColors = await groups.evaluateAll((els) => els.map((el) => el.style.borderColor));
    const yellow = borderColors.filter((c) => c.includes('rgb(170, 170, 0)')).length;
    const red = borderColors.filter((c) => c.includes('rgb(170, 0, 0)')).length;
    expect(yellow).toBe(1); // db
    expect(red).toBe(2); // web, api
  });

  test('custom severity override makes yellow more critical than red', async ({
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '113' });
    const panel = panelEditPage.panel.locator;
    await expect(panel).not.toContainText('No data');

    // Two fields with overridesBorderColor:
    //   cpu: #00aa00@0, #aaaa00@50, #aa0000@80 — severityOverrides: [{#aaaa00, severity: 2}]
    //   mem: #0000aa@0, #aa0000@80
    // Data: node-a(cpu=45,mem=30), node-b(cpu=67,mem=90), node-c(cpu=23,mem=50),
    //       node-d(cpu=82,mem=30), node-e(cpu=91,mem=90)
    //
    // Without custom severity, node-b would get mem red (score 1) > cpu yellow (score 0.5).
    // With severity override {#aaaa00: 2}, cpu yellow has severity 2 > mem red (score 1),
    // so node-b gets yellow override instead of red.
    //
    // node-a: cpu score 0, mem score 0 → no override
    // node-b: cpu yellow sev 2, mem red sev 1 → yellow wins → rgb(170, 170, 0)
    // node-c: cpu score 0, mem score 0 → no override
    // node-d: cpu red sev 1, mem score 0 → red → rgb(170, 0, 0)
    // node-e: cpu red sev 1, mem red sev 1 → red → rgb(170, 0, 0)
    const cells = panel.locator('div[style*="linear-gradient"]');
    await expect(cells).toHaveCount(5);
    const gradients = await cells.evaluateAll((els) =>
      els.map((el) => getComputedStyle(el).backgroundImage)
    );
    const withYellow = gradients.filter((g) => g.includes('rgb(170, 170, 0)')).length;
    const withRed = gradients.filter((g) => g.includes('rgb(170, 0, 0)')).length;
    const withNoOverride = gradients.filter(
      (g) => !g.includes('rgb(170, 170, 0)') && !g.includes('rgb(170, 0, 0)')
    ).length;
    expect(withYellow).toBe(1); // node-b: custom severity makes yellow win over red
    expect(withRed).toBe(2); // node-d, node-e
    expect(withNoOverride).toBe(2); // node-a, node-c
  });
});

// ── Rendering Types ──

// All panels use the same data: node-a(cpu=45,mem=70,disk=30,net=55),
//   node-b(cpu=82,mem=40,disk=85,net=20), node-c(cpu=23,mem=90,disk=60,net=75)
// Field overrides: cpu=text, mem=colored-text, disk=colored-background, net=gauge
// Thresholds: #00aa00@0, #aaaa00@50, #aa0000@80
async function checkRenderingTypes(container: import('@playwright/test').Locator) {
  // All field labels present
  await expect(container).toContainText('cpu');
  await expect(container).toContainText('mem');
  await expect(container).toContainText('disk');
  await expect(container).toContainText('net');

  const info = await container.evaluate((el) => {
    const spans = el.querySelectorAll('span');
    let coloredTextValues = 0;
    let coloredBgSpans = 0;
    let gaugeContainers = 0;
    for (const span of spans) {
      const style = span.style;
      if (style.backgroundColor && !style.color) {
        coloredBgSpans++;
      } else if (style.backgroundColor && style.color) {
        coloredBgSpans++;
      }
    }
    // Colored background: spans with inline background-color
    coloredBgSpans = el.querySelectorAll('span[style*="background-color"]').length;
    // Gauge: BarGauge renders inside a container with overflow:hidden and specific dimensions
    const allDivs = el.querySelectorAll('div');
    for (const div of allDivs) {
      const cs = getComputedStyle(div);
      if (cs.overflow === 'hidden' && cs.width === '80px' && cs.height === '15px') {
        gaugeContainers++;
      }
    }
    // Colored text: spans with inline color but no background-color
    const colorSpans = el.querySelectorAll('span[style*="color"]');
    for (const span of colorSpans) {
      if (!span.style.backgroundColor && span.style.color) {
        coloredTextValues++;
      }
    }
    // Text mode: value spans without any inline style (harder to count precisely)
    return { coloredBgSpans, gaugeContainers, coloredTextValues };
  });

  // disk field uses colored-background → 1 span per row
  expect(info.coloredBgSpans).toBeGreaterThanOrEqual(1);
  // net field uses gauge → 1 gauge container per row
  expect(info.gaugeContainers).toBeGreaterThanOrEqual(1);
  // mem field uses colored-text, net/gauge also has colored value text → at least 1
  expect(info.coloredTextValues).toBeGreaterThanOrEqual(1);
}

test.describe('rendering types', () => {
  test('rich table shows all rendering types', async ({
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '120' });
    const panel = panelEditPage.panel.locator;
    await expect(panel).toContainText('node-a');
    // 3 cards, each with 4 fields rendered in different modes
    await checkRenderingTypes(panel);
  });

  test('cell tooltip shows all rendering types', async ({
    page,
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '121' });
    const panel = panelEditPage.panel.locator;
    await expect(panel).not.toContainText('No data');
    // Open tooltip by clicking a cell
    await panel.locator('[data-testid="resource-cell"]').first().click();
    const tooltip = page.locator('[data-testid="resource-tooltip"]');
    await expect(tooltip).toContainText('cpu');
    await checkRenderingTypes(tooltip);
  });

  test('group entries show all rendering types', async ({
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '122' });
    const panel = panelEditPage.panel.locator;
    // Groups by status: 0 (node-b) and 1 (node-a, node-c)
    // Group entries show cpu, mem, disk, net from first row
    await expect(panel).toContainText('node-a');
    await checkRenderingTypes(panel);
  });

  test('table tooltip shows all rendering types', async ({
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '123' });
    const panel = panelEditPage.panel.locator;
    await expect(panel).toContainText('node-a');
    // Click "show more" to expand the table tooltip
    const showMoreBtn = panel.locator('button', { hasText: 'show more' }).first();
    await expect(showMoreBtn).toBeVisible();
    await showMoreBtn.click();
    // The expanded region should contain all rendering types
    await expect(panel).toContainText('cpu');
    await checkRenderingTypes(panel);
  });
});
