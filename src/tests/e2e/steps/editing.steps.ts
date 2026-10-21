import { expect, type Page } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const { When, Then } = createBdd();
const fixture = resolve('src/tests/e2e/fixtures/colors.png');
let sourceHash = '';
const sourceFormats = new WeakMap<Page, string>();

async function settled(page: Page) {
  const processing = page.getByTestId('edit_processing');
  const started = await processing.isVisible({ timeout: 1000 }).catch(() => false);

  if (started) {
    await expect(processing).toHaveCount(0);
  }

  await expect(page.getByTestId('edit_error')).toHaveCount(0);
  await expect(page.getByTestId('edit_save')).toBeEnabled();
}

async function pixels(page: Page, x = 0, y = 0) {
  return page.getByTestId('picture').evaluate(
    async (element, coordinate) => {
      const image = element as HTMLImageElement;

      await image.decode();

      const canvas = document.createElement('canvas');

      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;

      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('Canvas context unavailable');
      }

      context.drawImage(image, 0, 0);

      return Array.from(context.getImageData(coordinate.x, coordinate.y, 1, 1).data);
    },
    { x, y },
  );
}

When('I open the color fixture', async ({ page }) => {
  sourceFormats.set(page, 'PNG');
  sourceHash = createHash('sha256')
    .update(await readFile(fixture))
    .digest('hex');
  await page.getByTestId('file_input').setInputFiles(fixture);

  await expect(page.getByTestId('picture')).toBeVisible();
});

When('I rotate the image clockwise', async ({ page }) => {
  await page.getByTestId('edit_rotate').click();
  await page.getByTestId('rotate_right').click();
  await settled(page);
});

Then(
  'the preview has dimensions {int} by {int}',
  async ({ page }, width: number, height: number) => {
    await expect
      .poll(async () =>
        page
          .getByTestId('picture')
          .evaluate((element) => [
            (element as HTMLImageElement).naturalWidth,
            (element as HTMLImageElement).naturalHeight,
          ]),
      )
      .toEqual([width, height]);
  },
);

Then('the rotated pixels match the original', async ({ page }) => {
  expect(await pixels(page)).toEqual([0, 235, 94, 255]);
});

async function saveAndReopen(page: Page, format: string) {
  await expect(page.getByTestId('edit_processing')).toHaveCount(0);
  await expect(page.getByTestId('edit_save')).toBeEnabled();

  const downloadPromise = page.waitForEvent('download');

  await page.getByTestId('edit_save').click();

  const download = await downloadPromise;
  const extension = format === 'JPEG' ? 'jpg' : format.toLowerCase();

  expect(download.suggestedFilename()).toMatch(new RegExp(`_edited\\.${extension}$`));

  const path = await download.path();

  if (!path) {
    throw new Error('Missing downloaded image');
  }

  await expect(page.getByTestId('edit_saved')).toBeVisible();

  await page.getByTestId('file_input').setInputFiles({
    name: `reopened.${extension}`,
    mimeType: `image/${format.toLowerCase()}`,
    buffer: await readFile(path),
  });

  await expect(page.getByTestId('picture')).toHaveAttribute('alt', `reopened.${extension}`);
  await expect(page.getByTestId('image_sidebar')).toBeVisible();
}

When('I save and reopen a {word} copy', async ({ page }, format: string) => {
  await page.getByTestId('export_format').selectOption(format.toLowerCase());
  await saveAndReopen(page, format);
});

When('I save and reopen a copy in the default format', async ({ page }) => {
  const format = await page.getByTestId('export_format').inputValue();
  const sourceFormat = format === 'original' ? sourceFormats.get(page) : format.toUpperCase();
  if (!sourceFormat) {
    throw new Error('Missing source format');
  }
  await saveAndReopen(page, sourceFormat);
});

async function encodeFixture(page: Page, format: string): Promise<string> {
  let encodedSource = '';
  await expect
    .poll(async () => {
      const response = await page.request.post(
        `/api/images/export?format=${format.toLowerCase()}`,
        {
          data: await readFile(fixture),
          headers: { 'Content-Type': 'application/octet-stream' },
        },
      );
      if (response.status() === 503) {
        const body: unknown = await response.json();
        if (body && typeof body === 'object' && 'error' in body && body.error === 'busy') {
          return false;
        }
      }
      if (!response.ok()) {
        throw new Error(`Fixture export failed (${response.status()}): ${await response.text()}`);
      }
      encodedSource = (await response.body()).toString('base64');
      return true;
    })
    .toBe(true);
  return encodedSource;
}

When('I reopen the fixture encoded as {word}', async ({ page }, format: string) => {
  sourceFormats.set(page, format.toUpperCase());
  let encodedSource: string | undefined;
  if (['BMP', 'TIFF', 'ICO'].includes(format)) {
    encodedSource = await encodeFixture(page, format);
  }
  const data =
    encodedSource ??
    (format === 'GIF'
      ? 'R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='
      : await page.getByTestId('picture').evaluate(async (element, format) => {
          const image = element as HTMLImageElement;
          await image.decode();
          const canvas = document.createElement('canvas');
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          const context = canvas.getContext('2d');
          if (!context) {
            throw new Error('Canvas context unavailable');
          }
          context.drawImage(image, 0, 0);
          return canvas.toDataURL(`image/${format.toLowerCase()}`).split(',')[1]!;
        }, format));
  await page.getByTestId('file_input').setInputFiles({
    name: 'source.png',
    mimeType: `image/${format.toLowerCase()}`,
    buffer: Buffer.from(data, 'base64'),
  });
  await expect(page.getByTestId('picture')).toHaveAttribute('alt', 'source.png');
});

Then('the selected export format is {word}', async ({ page }, format: string) => {
  await expect(page.getByTestId('export_format')).toHaveValue(format.toLowerCase());
});

Then('the source fixture is unchanged', async () => {
  expect(
    createHash('sha256')
      .update(await readFile(fixture))
      .digest('hex'),
  ).toBe(sourceHash);
});

When('I flip the image horizontally', async ({ page }) => {
  await page.getByTestId('edit_flip').click();
  await page.getByTestId('flip_horizontal').click();
  await settled(page);
});

When('I flip the image vertically', async ({ page }) => {
  await page.getByTestId('edit_flip').click();
  await page.getByTestId('flip_vertical').click();
  await settled(page);
});

Then('the left edge contains the original right edge', async ({ page }) => {
  expect(await pixels(page)).toEqual([252, 0, 126, 255]);
});

Then('the top edge contains the original bottom edge', async ({ page }) => {
  expect(await pixels(page)).toEqual([0, 235, 94, 255]);
});

When('I reset all edits', async ({ page }) => {
  await page.getByTestId('edit_reset').click();
  await settled(page);
});

When('I set brightness to {int}', async ({ page }, value: number) => {
  await page.getByTestId('edit_modify').click();
  await page.getByTestId('edit_brightness').fill(String(value));
  await settled(page);
});

When('I set contrast to {int}', async ({ page }, value: number) => {
  await page.getByTestId('edit_modify').click();
  await page.getByTestId('edit_contrast').fill(String(value));
  await settled(page);
});

When('I set sharpness to {int}', async ({ page }, value: number) => {
  await page.getByTestId('edit_modify').click();
  await page.getByTestId('edit_sharpness').fill(String(value));
  await settled(page);
});

Then('the preview is brighter', async ({ page }) => {
  expect(await pixels(page)).toEqual([51, 51, 51, 255]);
});

Then('the preview contrast changes', async ({ page }) => {
  expect(await pixels(page, 20, 10)).toEqual([21, 0, 0, 255]);
});

Then('the preview sharpness changes', async ({ page }) => {
  expect(await pixels(page, 63, 20)).not.toEqual([252, 100, 166, 255]);
});

Then('the original pixels are restored', async ({ page }) => {
  expect(await pixels(page, 20, 10)).toEqual([80, 50, 60, 255]);
});

When('I crop to a 20 by 10 rectangle at 5 and 6', async ({ page }) => {
  await page.getByTestId('crop_start').click();

  for (const [field, value] of Object.entries({ x: 5, y: 6, width: 20, height: 10 })) {
    await page.getByTestId(`crop_${field}`).fill(String(value));
  }

  await page.getByTestId('crop_apply').click();
  await settled(page);
});

When('I choose a square crop', async ({ page }) => {
  await page.getByTestId('crop_start').click();
  await page.getByTestId('crop_ratio').selectOption('1:1');
});

Then('the crop fields describe a square', async ({ page }) => {
  await expect(page.getByTestId('crop_width')).toHaveValue('48');
  await expect(page.getByTestId('crop_height')).toHaveValue('48');
});

When('I cancel the crop', async ({ page }) => {
  await page.getByTestId('crop_cancel').click();
  await settled(page);
});

When('I draw a crop rectangle', async ({ page }) => {
  await page.getByTestId('crop_start').click();
  await page.getByTestId('crop_ratio').selectOption('free');

  const area = await page.getByTestId('crop_surface').boundingBox();

  if (!area) {
    throw new Error('Missing crop area');
  }

  await page.mouse.move(area.x, area.y);
  await page.mouse.down();
  await page.mouse.move(area.x + area.width / 2, area.y + area.height / 2, { steps: 4 });
  await page.mouse.up();
  await page.getByTestId('crop_apply').click();
  await settled(page);
});

When('I enter an invalid crop', async ({ page }) => {
  await page.getByTestId('crop_start').click();
  await page.getByTestId('crop_width').fill('999');
});

Then('applying the crop is disabled', async ({ page }) => {
  await expect(page.getByTestId('crop_apply')).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('ritaglio');
});

When('I cancel navigation with unsaved changes', async ({ page }) => {
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('unsaved_dialog')).toBeVisible();
  await expect(page.getByTestId('unsaved_cancel')).toBeFocused();
  await page.screenshot({ path: 'test-results/unsaved-confirmation.png' });
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('unsaved_dialog')).toHaveCount(0);
});

When('I confirm navigation with unsaved changes', async ({ page }) => {
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('unsaved_dialog')).toBeVisible();
  await page.getByTestId('unsaved_discard').click();
});

When('the next export fails', async ({ page }) => {
  await page.route(
    '**/api/images/export?**',
    (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'save_failed' }),
      }),
    { times: 1 },
  );
  await page.getByTestId('edit_save').click();
});

Then('the export error is visible', async ({ page }) => {
  await expect(page.getByTestId('edit_error')).toContainText('Impossibile salvare');
});

Then('editing is disabled without an image', async ({ page }) => {
  await expect(page.getByTestId('edit_toggle')).toHaveCount(0);
  await expect(page.getByTestId('info_toggle')).toHaveCount(0);

  await page.keyboard.press('i');
  await page.keyboard.press('e');

  await expect(page.getByTestId('image_sidebar')).toHaveCount(0);
  await expect(page.getByTestId('zoom_toggle')).toHaveCount(0);
});

Then('adjustment controls are hidden', async ({ page }) => {
  for (const control of ['brightness', 'contrast', 'sharpness']) {
    await expect(page.getByTestId(`edit_${control}`)).toHaveCount(0);
  }
});

When('I open the adjustment tool', async ({ page }) => {
  await page.getByTestId('edit_modify').click();
  await expect(page.getByTestId('edit_modify')).toHaveText('Modifica');
  await expect(page.getByTestId('edit_modify')).toHaveAttribute('aria-pressed', 'true');
});

Then('the brightness adjustment remains {int}', async ({ page }, value: number) => {
  await expect(page.getByTestId('edit_brightness')).toHaveValue(String(value));
  await page.screenshot({ path: 'test-results/adjustment-controls.png' });
});

When('I save and reopen an Original copy as {word}', async ({ page }, expected: string) => {
  const options = page.getByTestId('export_format').locator('option');
  await expect(options.last()).toHaveText('Originale');
  await expect(options.last()).toHaveAttribute('value', 'original');
  await page.getByTestId('export_format').selectOption('webp');
  await page.getByTestId('export_format').selectOption('original');
  await saveAndReopen(page, expected.toUpperCase());
});

Then(
  'the selected export format for {word} matches its source',
  async ({ page }, format: string) => {
    await expect(page.getByTestId('export_format')).toHaveValue(
      ['png', 'jpeg', 'webp'].includes(format) ? format : 'original',
    );
  },
);

When('I cancel reloading with unsaved changes', async ({ page }) => {
  const dialog = page.waitForEvent('dialog');
  const reload = page.evaluate(() => window.location.reload());
  const confirmation = await dialog;
  expect(confirmation.type()).toBe('beforeunload');
  await confirmation.dismiss();
  await reload;
});

Then('the reload keeps unsaved edits', async ({ page }) => {
  await expect(page.getByTestId('edit_unsaved')).toBeVisible();
  await expect(page.getByTestId('unsaved_dialog')).toHaveCount(0);
});

When('I request leaving edits using {string}', async ({ page }, action: string) => {
  if (['Escape', 'e', 'i'].includes(action)) {
    await page.getByTestId('edit_toggle').focus();
    await page.keyboard.press(action);
  } else {
    await page.getByTestId(action).click();
  }
});

Then('the edit exit confirmation is visible', async ({ page }) => {
  await expect(page.getByTestId('unsaved_dialog')).toBeVisible();
  await expect(page.getByTestId('image_sidebar')).toHaveAttribute(
    'aria-label',
    'Modifica immagine',
  );
  await expect(page.getByTestId('unsaved_cancel')).toBeFocused();
  await expect(page.getByTestId('unsaved_discard')).toHaveText('Annulla modifiche');
  await page.screenshot({ path: 'test-results/edit-panel-exit-confirmation.png' });
});

When('I cancel leaving the edit panel', async ({ page }) => {
  await page.getByTestId('unsaved_cancel').click();
  await expect(page.getByTestId('unsaved_dialog')).toHaveCount(0);
  await expect(page.getByTestId('image_sidebar')).toHaveAttribute(
    'aria-label',
    'Modifica immagine',
  );
});

When('I confirm leaving the edit panel', async ({ page }) => {
  await page.getByTestId('unsaved_discard').click();
  await expect(page.getByTestId('unsaved_dialog')).toHaveCount(0);
});

Then('the active side panel is {string}', async ({ page }, panel: string) => {
  if (panel === 'closed') {
    await expect(page.getByTestId('image_sidebar')).toHaveCount(0);
  } else {
    await expect(page.getByTestId('image_sidebar')).toHaveAttribute(
      'aria-label',
      'Dettagli immagine',
    );
  }
});
