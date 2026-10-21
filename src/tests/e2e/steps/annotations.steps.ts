import { expect, type Page } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { When, Then } = createBdd();

async function draw(
  page: Page,
  tool: string,
  start: [number, number],
  end: [number, number],
  square = false,
) {
  await page.getByTestId(`annotation_tool_${tool}`).click();
  const bounds = await page.getByTestId('annotation_surface').boundingBox();
  if (!bounds) {
    throw new Error('Missing annotation surface');
  }
  await page.mouse.move(
    bounds.x + (start[0] * bounds.width) / 64,
    bounds.y + (start[1] * bounds.height) / 48,
  );
  if (square) {
    await page.keyboard.down('Shift');
  }
  await page.mouse.down();
  await page.mouse.move(
    bounds.x + (end[0] * bounds.width) / 64,
    bounds.y + (end[1] * bounds.height) / 48,
    { steps: 8 },
  );
  await page.mouse.up();
  if (square) {
    await page.keyboard.up('Shift');
  }
}

async function pixel(page: Page, x: number, y: number) {
  return page.getByTestId('picture').evaluate(
    async (element, position) => {
      const image = element as HTMLImageElement;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Missing canvas context');
      }
      context.drawImage(image, 0, 0);
      return Array.from(context.getImageData(position.x, position.y, 1, 1).data);
    },
    { x, y },
  );
}

When('I draw a filled square at double zoom', async ({ page }) => {
  await page.keyboard.press('Control+2');
  await expect(page.getByTestId('picture')).toHaveCSS('width', '128px');
  await page.getByTestId('annotation_tool_rectangle').click();
  await page.getByTestId('annotation_fill').check();
  await draw(page, 'rectangle', [10, 10], [30, 35], true);
  await page.screenshot({ path: 'test-results/annotations.png' });
});

Then('annotations have unsaved changes', async ({ page }) => {
  await expect(page.getByTestId('edit_unsaved')).toBeVisible();
  await expect(page.getByTestId('annotation_selection')).toHaveCount(0);
  await expect(page.getByTestId('annotation_surface').locator('canvas')).toBeVisible();
});

Then('the square is included in the image', async ({ page }) => {
  expect(await pixel(page, 20, 20)).toEqual([255, 0, 0, 255]);
});

When('I draw and move a circle', async ({ page }) => {
  await draw(page, 'circle', [10, 10], [25, 30]);
  await draw(page, 'rectangle', [17, 17], [22, 22]);
  await expect(page.getByTestId('annotation_tool_select')).toHaveAttribute('aria-pressed', 'true');
});

When('I resize the selected annotation', async ({ page }) => {
  const handle = await page.getByTestId('annotation_resize').boundingBox();
  if (!handle) {
    throw new Error('Missing resize handle');
  }
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + 7, handle.y + 7);
  await page.mouse.up();
});

When('I undo and redo the annotation', async ({ page }) => {
  await page.getByTestId('annotation_undo').click();
  await page.getByTestId('annotation_redo').click();
  await draw(page, 'pen', [22, 22], [22, 22]);
  await expect(page.getByTestId('annotation_tool_select')).toHaveAttribute('aria-pressed', 'true');
});

When('I delete the selected annotation', async ({ page }) => {
  await page.getByTestId('annotation_delete').click();
});

Then('no annotations remain', async ({ page }) => {
  await expect(page.getByTestId('annotation_selection')).toHaveCount(0);
  await expect(page.getByTestId('annotation_delete')).toBeDisabled();
  await expect(page.getByTestId('annotation_resize')).toHaveCount(0);
});

When('I draw an annotation line', async ({ page }) => {
  await draw(page, 'line', [10, 10], [40, 10]);
});

Then('the annotation line is included after rotation', async ({ page }) => {
  expect(await pixel(page, 37, 20)).toEqual([255, 0, 0, 255]);
});

When('I draw a highlighter stroke', async ({ page }) => {
  await draw(page, 'highlight', [10, 10], [40, 10]);
});

Then('the exported highlighter is translucent', async ({ page }) => {
  const rgba = await pixel(page, 20, 10);
  expect(rgba[0]).toBeGreaterThan(80);
  expect(rgba[0]).toBeLessThan(255);
  expect(rgba[1]).toBeGreaterThan(0);
  expect(rgba[1]).toBeLessThan(50);
});

When('I place and edit multiline text', async ({ page }) => {
  await page.getByTestId('annotation_tool_text').click();
  await page.getByTestId('annotation_text').fill('A\nB');
  await page.getByTestId('annotation_font_size').fill('12');
  await draw(page, 'text', [5, 5], [5, 5]);
  await draw(page, 'rectangle', [8, 8], [8, 8]);
  await expect(page.getByTestId('annotation_tool_select')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('annotation_selection')).toHaveCount(0);
  await page.getByTestId('annotation_text').fill('C\nD');
  await page.getByTestId('annotation_font_size').fill('14');
  await page.getByTestId('annotation_color').focus();
});

Then('the exported image contains annotation text', async ({ page }) => {
  const redPixels = await page.getByTestId('picture').evaluate(async (element) => {
    const image = element as HTMLImageElement;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Missing canvas context');
    }
    context.drawImage(image, 0, 0);
    const data = context.getImageData(5, 5, 15, 35).data;
    let count = 0;
    for (let index = 0; index < data.length; index += 4) {
      if (data[index]! > 240 && data[index + 1]! < 10 && data[index + 2]! < 10) {
        count++;
      }
    }
    return count;
  });
  expect(redPixels).toBeGreaterThan(10);
});

When('I draw a pen stroke', async ({ page }) => {
  await draw(page, 'pen', [10, 10], [40, 10]);
});

Then('the exported image contains a pen stroke', async ({ page }) => {
  const rgba = await pixel(page, 20, 10);
  expect(rgba[0]).toBeGreaterThan(180);
  expect(rgba[1]).toBeLessThan(70);
});

When('I open a large annotation fixture', async ({ page }) => {
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 2400;
    canvas.height = 100;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Missing canvas context');
    }
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png').split(',')[1]!;
  });
  await page.getByTestId('file_input').setInputFiles({
    name: 'large.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png, 'base64'),
  });
  await expect(page.getByTestId('picture')).toBeVisible();
});

When('I annotate and export the large image', async ({ page }) => {
  await page.getByTestId('annotation_tool_rectangle').click();
  await page.getByTestId('annotation_fill').check();
  const bounds = await page.getByTestId('annotation_surface').boundingBox();
  if (!bounds) {
    throw new Error('Missing annotation surface');
  }
  await page.mouse.move(bounds.x + bounds.width * 0.25, bounds.y + bounds.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.35, bounds.y + bounds.height * 0.6);
  await page.mouse.up();
});

Then('the full-size exported annotation has the expected pixels', async ({ page }) => {
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('edit_save').click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) {
    throw new Error('Missing downloaded image');
  }
  const { readFile } = await import('node:fs/promises');
  const bytes = await readFile(path);
  expect(bytes.readUInt32BE(16)).toBe(2400);
  expect(bytes.readUInt32BE(20)).toBe(100);
  const pixel = await page.evaluate(async (png) => {
    const image = await createImageBitmap(new Blob([new Uint8Array(png)], { type: 'image/png' }));
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Missing canvas context');
    }
    context.drawImage(image, 0, 0);
    return Array.from(context.getImageData(700, 45, 1, 1).data);
  }, Array.from(bytes));
  expect(pixel).toEqual([255, 0, 0, 255]);
});

When('I open the annotations tool', async ({ page }) => {
  await page.getByTestId('edit_annotations').click();
  await expect(page.getByTestId('annotation_tool_select')).toHaveAttribute('aria-pressed', 'true');
});

Then('annotation controls are hidden', async ({ page }) => {
  await expect(page.getByTestId('annotation_tool_select')).toHaveCount(0);
  await expect(page.getByTestId('edit_annotations')).toHaveAttribute('aria-pressed', 'false');
});

Then('annotation tools have icons and tooltips', async ({ page }) => {
  await expect(page.getByTestId('edit_annotations')).toHaveText('Disegna');
  const undo = await page.getByTestId('annotation_undo').boundingBox();
  const redo = await page.getByTestId('annotation_redo').boundingBox();
  const select = await page.getByTestId('annotation_tool_select').boundingBox();
  const rectangle = await page.getByTestId('annotation_tool_rectangle').boundingBox();
  if (!undo || !redo || !select || !rectangle) {
    throw new Error('Missing annotation controls');
  }
  expect(undo.y).toBe(redo.y);
  expect(redo.y).toBe(select.y);
  expect(undo.x).toBeLessThan(redo.x);
  expect(redo.x).toBeLessThan(select.x);
  expect(select.y + select.height).toBeLessThan(rectangle.y);
  for (const tool of [
    'select',
    'rectangle',
    'circle',
    'line',
    'text',
    'pen',
    'highlight',
    'undo',
    'redo',
    'delete',
  ]) {
    const button = page.getByTestId(
      `annotation_${['undo', 'redo', 'delete'].includes(tool) ? '' : 'tool_'}${tool}`,
    );
    const label = await button.getAttribute('aria-label');
    expect(label).toBeTruthy();
    await expect(button).toHaveAttribute('title', label!);
    const icon = button.locator('[aria-hidden="true"]');
    await expect(icon).toBeVisible();
    await expect(icon).toHaveCSS('mask-image', /url\(/);
  }
  await page.getByTestId('annotation_tool_rectangle').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('annotation_tool_rectangle')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.screenshot({ path: 'test-results/annotation-controls.png' });
});
