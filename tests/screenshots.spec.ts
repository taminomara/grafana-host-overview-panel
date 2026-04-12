import { test } from '@grafana/plugin-e2e';
import type { Locator } from '@playwright/test';

const SCREENSHOTS_DASHBOARD = 'screenshots.json';

const DOCS_IMG = 'docs/docs/img';

const DEFAULT_PADDING = 16;

async function screenshot(
  locator: Locator,
  path: string,
  options?: { padding?: number | [number, number, number, number]; crop?: [number, number] }
) {
  let padding = options?.padding ?? DEFAULT_PADDING;
  if (typeof padding === 'number') {
    padding = [padding, padding, padding, padding];
  }
  const page = locator.page();
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error(`Element not visible, cannot screenshot for ${path}`);
  }
  const viewport = page.viewportSize() ?? { width: 1280, height: 720 };
  const clip = {
    x: Math.max(0, box.x - padding[3]),
    y: Math.max(0, box.y - padding[0]),
    width: Math.min(
      viewport.width - Math.max(0, box.x - padding[3]),
      box.width + padding[1] + padding[3]
    ),
    height: Math.min(
      viewport.height - Math.max(0, box.y - padding[0]),
      box.height + padding[0] + padding[2]
    ),
  };
  if (options?.crop) {
    clip.width = Math.min(clip.width, options.crop[0]);
    clip.height = Math.min(clip.height, options.crop[1]);
  }
  await page.screenshot({ path, clip });
}

// ── Hero Screenshots (existing dashboards) ──

test.describe('hero screenshots', () => {
  test('service overview', async ({ readProvisionedDashboard, gotoDashboardPage }) => {
    const dashboard = await readProvisionedDashboard({ fileName: 'service.json' });
    const page = await gotoDashboardPage(dashboard);
    const panel = page.getPanelByTitle('Node liveness');
    const content = panel.locator.getByTestId('data-testid panel content').first();
    await content.waitFor();
    await screenshot(content, `${DOCS_IMG}/service.png`, {
      padding: 5,
      crop: [900, 600],
    });
  });

  test('datacenter overview', async ({ gotoDashboardPage, readProvisionedDashboard }) => {
    const dashboard = await readProvisionedDashboard({ fileName: 'datacenter.json' });
    const page = await gotoDashboardPage(dashboard);
    const panel = page.getPanelByTitle('Cluster overview');
    const content = panel.locator.getByTestId('data-testid panel content').first();
    await content.waitFor();
    await screenshot(content, `${DOCS_IMG}/dc.png`, {
      padding: 5,
      crop: [900, 600],
    });
  });

  test('database instances', async ({ gotoDashboardPage, readProvisionedDashboard }) => {
    const dashboard = await readProvisionedDashboard({ fileName: 'db.json' });
    const page = await gotoDashboardPage(dashboard);
    const panel = page.getPanelByTitle('Database Instances');
    const content = panel.locator.getByTestId('data-testid panel content').first();
    await content.waitFor();
    await screenshot(content, `${DOCS_IMG}/db.png`, {
      padding: 5,
      crop: [900, 300],
    });
  });
});

test.describe('basic-setup', () => {
  test('Prometheus query for up metric', async ({
    page,
    readProvisionedDashboard,
    gotoPanelEditPage,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: SCREENSHOTS_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '1' });
    const queryEditorRow = panelEditPage.getQueryEditorRow('UP');
    await queryEditorRow.getByTestId('data-testid prometheus options').click();
    const panel = page.getByTestId('data-testid Panel editor data pane content');
    await screenshot(panel, `${DOCS_IMG}/basic-setup-1.png`, { padding: 0 });
  });

  test('Transformations', async ({
    page,
    readProvisionedDashboard,
    gotoPanelEditPage,
    selectors,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: SCREENSHOTS_DASHBOARD });
    await gotoPanelEditPage({ dashboard, id: '1' });
    await page.getByTestId('data-testid Tab Transformations').click();
    const panel = page.getByTestId('data-testid Panel editor data pane content');
    await screenshot(panel, `${DOCS_IMG}/basic-setup-2.png`, { padding: 0 });
  });

  test('Groups editor', async ({
    page,
    readProvisionedDashboard,
    gotoPanelEditPage,
    selectors,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: SCREENSHOTS_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '1' });
    const optionsSection = panelEditPage.getCustomOptions('Grouping and layout');
    await optionsSection.expand();
    await optionsSection.element.scrollIntoViewIfNeeded();
    const options = optionsSection.element.getByLabel(/Resource groups/);
    await options.scrollIntoViewIfNeeded();
    await options.getByRole('combobox', { name: 'Select a field' }).blur();
    await screenshot(options, `${DOCS_IMG}/basic-setup-3.png`, { padding: [80, 32, 40, 32] });
  });

  test('Grid layout', async ({ page, readProvisionedDashboard, gotoPanelEditPage, selectors }) => {
    const dashboard = await readProvisionedDashboard({ fileName: SCREENSHOTS_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '1' });
    const optionsSection = panelEditPage.getCustomOptions('Grouping and layout');
    await optionsSection.expand();
    await optionsSection.element.scrollIntoViewIfNeeded();
    const options = optionsSection.element.getByLabel(/Resources layout/).first();
    await options.scrollIntoViewIfNeeded();
    await screenshot(options, `${DOCS_IMG}/basic-setup-5.png`, { padding: [40, 32, 80, 32] });
  });

  test('Resource ID editor', async ({
    page,
    readProvisionedDashboard,
    gotoPanelEditPage,
    selectors,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: SCREENSHOTS_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '1' });
    const optionsSection = panelEditPage.getCustomOptions('Resource');
    await optionsSection.expand();
    await optionsSection.element.scrollIntoViewIfNeeded();
    const options = optionsSection.element.getByLabel(/ID field/);
    await options.scrollIntoViewIfNeeded();
    await options.getByRole('combobox', { name: 'Select a field' }).blur();
    await screenshot(options, `${DOCS_IMG}/basic-setup-5.png`, { padding: [80, 32, 40, 32] });
  });

  test('Resource content', async ({
    page,
    readProvisionedDashboard,
    gotoPanelEditPage,
    selectors,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: SCREENSHOTS_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '1' });
    const optionsSection = panelEditPage.getCustomOptions('Resource content');
    await optionsSection.expand();
    await optionsSection.element.scrollIntoViewIfNeeded();
    await screenshot(optionsSection.element, `${DOCS_IMG}/basic-setup-6.png`, {
      padding: [40, 16, 40, 16],
    });
  });

  test('Status override', async ({
    page,
    readProvisionedDashboard,
    gotoPanelEditPage,
    selectors,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: SCREENSHOTS_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '1' });
    const optionsSection = page.getByTestId('data-testid Options group panel-options-override-0');
    await optionsSection.scrollIntoViewIfNeeded();
    await screenshot(optionsSection, `${DOCS_IMG}/basic-setup-7.png`, {
      padding: [40, 16, 40, 16],
    });
  });

  test('Result', async ({ page, readProvisionedDashboard, gotoPanelEditPage, selectors }) => {
    const dashboard = await readProvisionedDashboard({ fileName: SCREENSHOTS_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '1' });
    await panelEditPage.panel.locator.getByText('taminomara-hostoverview-panel').hover();
    await screenshot(panelEditPage.panel.locator, `${DOCS_IMG}/basic-setup-result.png`);
  });
});

test.describe('joins', () => {
  test('Primary frame', async ({
    page,
    readProvisionedDashboard,
    gotoPanelEditPage,
    selectors,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: SCREENSHOTS_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '3' });
    const optionsSection = panelEditPage.getCustomOptions('Host overview');
    await optionsSection.expand();
    await optionsSection.element.scrollIntoViewIfNeeded();
    const options = optionsSection.element.getByLabel(/Data frame/);
    await options.scrollIntoViewIfNeeded();
    await options.getByRole('combobox', { name: 'First data frame' }).focus();
    await screenshot(options, `${DOCS_IMG}/joins-1.png`, {
      padding: [80, 32, 40, 32],
    });
  });

  test('Container CPU and Memory queries', async ({
    page,
    readProvisionedDashboard,
    gotoPanelEditPage,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: SCREENSHOTS_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '3' });
    await panelEditPage.getQueryEditorRow('CONTAINER_MEM').scrollIntoViewIfNeeded();
    await panelEditPage.getQueryEditorRow('CONTAINER_CPU').scrollIntoViewIfNeeded();
    const panel = page.getByTestId('data-testid Panel editor data pane content');
    await screenshot(panel, `${DOCS_IMG}/joins-2.png`, { padding: 0 });
  });

  test('Duplicate frames error', async ({
    page,
    readProvisionedDashboard,
    gotoPanelEditPage,
    selectors,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: SCREENSHOTS_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '2' });
    await screenshot(panelEditPage.panel.locator, `${DOCS_IMG}/joins-3.png`);
  });

  test('Transformations', async ({
    page,
    readProvisionedDashboard,
    gotoPanelEditPage,
    selectors,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: SCREENSHOTS_DASHBOARD });
    await gotoPanelEditPage({ dashboard, id: '3' });
    await page.getByTestId('data-testid Tab Transformations').click();
    await page
      .getByTestId('data-testid Transformation editor Time series to table')
      .scrollIntoViewIfNeeded();
    const panel = page.getByTestId('data-testid Panel editor data pane content');
    await screenshot(panel, `${DOCS_IMG}/joins-4.png`, { padding: 0 });
  });

  test('Table view', async ({ page, readProvisionedDashboard, gotoPanelEditPage, selectors }) => {
    const dashboard = await readProvisionedDashboard({ fileName: SCREENSHOTS_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '2' });
    await panelEditPage.toggleTableView();
    await screenshot(
      page.getByTestId('data-testid Panel editor content').locator('div div').first(),
      `${DOCS_IMG}/joins-5.png`,
      {
        crop: [1000, 520],
      }
    );
  });

  test('Add entry', async ({ page, readProvisionedDashboard, gotoPanelEditPage, selectors }) => {
    const dashboard = await readProvisionedDashboard({ fileName: SCREENSHOTS_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '2' });
    const optionsSection = panelEditPage.getCustomOptions('Resource content');
    await optionsSection.expand();
    await optionsSection.element.scrollIntoViewIfNeeded();
    const options = optionsSection.element.getByLabel(/Fields and joins/);
    await options.scrollIntoViewIfNeeded();
    await options.getByRole('button', { name: 'Add entry' }).click();
    await page.getByRole('menuitem', { name: 'Join Join data from another' }).hover();
    await screenshot(page.getByRole('menu'), `${DOCS_IMG}/joins-6.png`, {
      padding: [100, 128, 60, 16],
    });
  });

  test('CPU join configuration', async ({
    page,
    readProvisionedDashboard,
    gotoPanelEditPage,
    selectors,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: SCREENSHOTS_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '3' });
    const optionsSection = panelEditPage.getCustomOptions('Resource content');
    await optionsSection.expand();
    await optionsSection.element.scrollIntoViewIfNeeded();
    const options = optionsSection.element.getByLabel(/Fields and joins/);
    await options.scrollIntoViewIfNeeded();
    const row = options.getByTestId('hostoverview-panel-field-row').first();
    await row.getByRole('button', { name: 'Expand', exact: true }).first().click();
    await row.scrollIntoViewIfNeeded();
    await screenshot(row, `${DOCS_IMG}/joins-7.png`, {
      padding: [80, 32, 40, 32],
    });
  });

  test('CPU override', async ({ page, readProvisionedDashboard, gotoPanelEditPage, selectors }) => {
    const dashboard = await readProvisionedDashboard({ fileName: SCREENSHOTS_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '3' });
    const optionsSection = page.getByTestId('data-testid Options group panel-options-override-1');
    await optionsSection.scrollIntoViewIfNeeded();
    await screenshot(optionsSection, `${DOCS_IMG}/joins-8.png`, {
      padding: [40, 16, 40, 16],
    });
  });

  test('Result', async ({ page, readProvisionedDashboard, gotoPanelEditPage, selectors }) => {
    const dashboard = await readProvisionedDashboard({ fileName: SCREENSHOTS_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '3' });
    await panelEditPage.panel.locator.getByText('taminomara-hostoverview-panel').hover();
    await screenshot(panelEditPage.panel.locator, `${DOCS_IMG}/joins-result.png`);
  });
});

test.describe('cell-color-overrides', () => {
  test('Memory override', async ({
    page,
    readProvisionedDashboard,
    gotoPanelEditPage,
    selectors,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: SCREENSHOTS_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '4' });
    const optionsSection = page.getByTestId('data-testid Options group panel-options-override-2');
    await optionsSection.scrollIntoViewIfNeeded();
    await screenshot(optionsSection, `${DOCS_IMG}/cell-color-overrides-1.png`, {
      padding: [40, 16, 40, 16],
    });
  });

  test('Cell color override', async ({
    page,
    readProvisionedDashboard,
    gotoPanelEditPage,
    selectors,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: SCREENSHOTS_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '4' });
    const optionsSection = panelEditPage.getCustomOptions('Resource content');
    const options = optionsSection.element.getByLabel(/Fields and joins/);
    await options.scrollIntoViewIfNeeded();
    const row = options.getByTestId('hostoverview-panel-field-row').nth(1);
    await row.getByRole('button', { name: 'Expand', exact: true }).first().click();
    await row.scrollIntoViewIfNeeded();
    await screenshot(row, `${DOCS_IMG}/cell-color-overrides-2.png`, {
      padding: [80, 32, 40, 32],
    });
  });

  test('Result', async ({ page, readProvisionedDashboard, gotoPanelEditPage, selectors }) => {
    const dashboard = await readProvisionedDashboard({ fileName: SCREENSHOTS_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '4' });
    await panelEditPage.panel.locator.getByText('taminomara-hostoverview-panel').hover();
    await screenshot(panelEditPage.panel.locator, `${DOCS_IMG}/cell-color-overrides-result.png`);
  });
});

test.describe('sidecars', () => {
  test('Sidecar settings', async ({
    page,
    readProvisionedDashboard,
    gotoPanelEditPage,
    selectors,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: SCREENSHOTS_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '5' });
    const optionsSection = panelEditPage.getCustomOptions('Sidecar');
    await optionsSection.expand();
    await optionsSection.element.scrollIntoViewIfNeeded();
    await screenshot(optionsSection.element, `${DOCS_IMG}/sidecars-1.png`, {
      padding: [40, 16, 40, 16],
    });
  });

  test('Result', async ({ page, readProvisionedDashboard, gotoPanelEditPage, selectors }) => {
    const dashboard = await readProvisionedDashboard({ fileName: SCREENSHOTS_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '5' });
    await screenshot(panelEditPage.panel.locator, `${DOCS_IMG}/sidecars-result.png`);
  });
});

test.describe('adding-known-ids', () => {
  test('Known IDs setting', async ({
    page,
    readProvisionedDashboard,
    gotoPanelEditPage,
    selectors,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: SCREENSHOTS_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '6' });
    const optionsSection = panelEditPage.getCustomOptions('Resource');
    await optionsSection.expand();
    await optionsSection.element.scrollIntoViewIfNeeded();
    const options = optionsSection.element.getByLabel(/Known IDs/).first();
    await options.scrollIntoViewIfNeeded();
    await screenshot(options, `${DOCS_IMG}/adding-known-ids-1.png`, {
      padding: [80, 32, 40, 32],
    });
  });

  test('Value mapping for missing resources', async ({
    page,
    readProvisionedDashboard,
    gotoPanelEditPage,
    selectors,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: SCREENSHOTS_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '6' });
    const optionsSection = page.getByTestId('data-testid Options group panel-options-override-0');
    await optionsSection.scrollIntoViewIfNeeded();
    await screenshot(optionsSection, `${DOCS_IMG}/adding-known-ids-2.png`, {
      padding: [40, 16, 40, 16],
    });
  });

  test('Result', async ({ page, readProvisionedDashboard, gotoPanelEditPage, selectors }) => {
    const dashboard = await readProvisionedDashboard({ fileName: SCREENSHOTS_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '6' });
    await panelEditPage.panel.locator.getByText('haproxy').hover();
    await screenshot(panelEditPage.panel.locator, `${DOCS_IMG}/adding-known-ids-result.png`);
  });
});

test.describe('joins-groups', () => {
  test('Host CPU and Memory queries', async ({
    page,
    readProvisionedDashboard,
    gotoPanelEditPage,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: SCREENSHOTS_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '7' });
    await panelEditPage.getQueryEditorRow('HOST_DISK').scrollIntoViewIfNeeded();
    await panelEditPage.getQueryEditorRow('HOST_CPU').scrollIntoViewIfNeeded();
    const panel = page.getByTestId('data-testid Panel editor data pane content');
    await screenshot(panel, `${DOCS_IMG}/joins-groups-1.png`, { padding: 0 });
  });

  test('Host group new field', async ({ page, readProvisionedDashboard, gotoPanelEditPage }) => {
    const dashboard = await readProvisionedDashboard({ fileName: SCREENSHOTS_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '7' });
    const optionsSection = panelEditPage.getCustomOptions('Grouping and layout');
    await optionsSection.expand();
    await optionsSection.element.scrollIntoViewIfNeeded();
    const options = optionsSection.element.getByLabel(/Resource groups/);
    await options.scrollIntoViewIfNeeded();
    await options.getByRole('button', { name: 'Settings' }).click();
    await page.getByTestId('toggletip-content').getByRole('button', { name: 'Add entry' }).click();
    await page.getByRole('menuitem', { name: 'Join Join data from another' }).hover();
    await screenshot(page.getByRole('menu'), `${DOCS_IMG}/joins-groups-2.png`, {
      padding: [100, 1000, 100, 16],
    });
  });

  test('Host group joins', async ({ page, readProvisionedDashboard, gotoPanelEditPage }) => {
    const dashboard = await readProvisionedDashboard({ fileName: SCREENSHOTS_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '8' });
    const optionsSection = panelEditPage.getCustomOptions('Grouping and layout');
    await optionsSection.expand();
    await optionsSection.element.scrollIntoViewIfNeeded();
    const options = optionsSection.element.getByLabel(/Resource groups/);
    await options.scrollIntoViewIfNeeded();
    await options.getByRole('button', { name: 'Settings' }).click();
    const fieldRow = page.getByTestId('hostoverview-panel-field-row').first();
    await fieldRow.getByRole('button', { name: 'Expand', exact: true }).first().click();
    await page.getByText('To configure links, actions,').scrollIntoViewIfNeeded();
    await fieldRow.scrollIntoViewIfNeeded();
    await screenshot(fieldRow, `${DOCS_IMG}/joins-groups-3.png`, {
      padding: [100, 1000, 100, 32],
    });
  });

  test('Status override', async ({
    page,
    readProvisionedDashboard,
    gotoPanelEditPage,
    selectors,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: SCREENSHOTS_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '8' });
    const optionsSection = page.getByTestId('data-testid Options group panel-options-override-3');
    await optionsSection.scrollIntoViewIfNeeded();
    await screenshot(optionsSection, `${DOCS_IMG}/joins-groups-4.png`, {
      padding: [40, 16, 40, 16],
    });
  });

  test('Result', async ({ page, readProvisionedDashboard, gotoPanelEditPage, selectors }) => {
    const dashboard = await readProvisionedDashboard({ fileName: SCREENSHOTS_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '8' });
    await screenshot(panelEditPage.panel.locator, `${DOCS_IMG}/joins-groups-result.png`);
  });
});

test.describe('data-links', () => {
  test('Host data link override', async ({
    page,
    readProvisionedDashboard,
    gotoPanelEditPage,
    selectors,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: SCREENSHOTS_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '9' });
    const optionsSection = page.getByTestId('data-testid Options group panel-options-override-6');
    await optionsSection.scrollIntoViewIfNeeded();
    await screenshot(optionsSection, `${DOCS_IMG}/data-links-1.png`, {
      padding: [40, 16, 40, 16],
    });
  });

  test('Container data link override', async ({
    page,
    readProvisionedDashboard,
    gotoPanelEditPage,
    selectors,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: SCREENSHOTS_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '9' });
    const optionsSection = page.getByTestId('data-testid Options group panel-options-override-7');
    await optionsSection.scrollIntoViewIfNeeded();
    await screenshot(optionsSection, `${DOCS_IMG}/data-links-2.png`, {
      padding: [40, 16, 40, 16],
    });
  });

  test('Result', async ({ page, readProvisionedDashboard, gotoPanelEditPage, selectors }) => {
    const dashboard = await readProvisionedDashboard({ fileName: SCREENSHOTS_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '9' });
    await panelEditPage.panel.locator.getByText('taminomara-hostoverview-panel').hover();
    await screenshot(panelEditPage.panel.locator, `${DOCS_IMG}/data-links-result.png`);
  });
});
