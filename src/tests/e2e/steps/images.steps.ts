import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const { When, Then } = createBdd();
const first = 'first.png';
const second = 'second.png';
const image = readFileSync(fileURLToPath(new URL('../fixtures/colors.png', import.meta.url)));

When('I select two images', async ({ page }) => {
  await page
    .getByTestId('file_input')
    .setInputFiles([first, second].map((name) => ({ name, mimeType: 'image/png', buffer: image })));

  await expect(page.getByTestId('picture')).toBeVisible();
});

Then('the first image is displayed', async ({ page }) => {
  await expect(page.getByTestId('picture')).toHaveAttribute('alt', first);
  await expect(page.getByTestId('previous_image')).toBeDisabled();
  await expect(page.getByTestId('image_position')).toHaveCount(0);

  const navigation = await page.getByTestId('image_navigation').boundingBox();
  const zoom = await page.getByTestId('zoom_toggle').boundingBox();

  expect(zoom?.height).toBe(navigation?.height);
  expect(zoom?.y).toBe(navigation?.y);

  await page.screenshot({ animations: 'disabled', path: 'test-results/viewer-dark.png' });
});

When('I open the details panel', async ({ page }) => {
  await page.getByTestId('info_toggle').click();
});

Then('the image metadata is visible', async ({ page }) => {
  await expect(page.getByTestId('image_sidebar')).toContainText('64 × 48');
  await expect(page.getByTestId('image_sidebar')).toContainText('PNG');
  await expect(page.getByTestId('image_sidebar')).toHaveCSS('opacity', '1');

  await page.screenshot({ animations: 'disabled', path: 'test-results/viewer-info.png' });
});

When('I move to the next image', async ({ page }) => {
  await page.keyboard.press('ArrowRight');
});

Then('the second image is displayed', async ({ page }) => {
  await expect(page.getByTestId('picture')).toHaveAttribute('alt', second);
  await expect(page.getByTestId('next_image')).toBeDisabled();
});

When('I choose 200 percent zoom', async ({ page }) => {
  await page.getByTestId('zoom_toggle').click();
  await page.getByTestId('zoom_200').click();
});

Then('the image is displayed at double size', async ({ page }) => {
  await expect(page.getByTestId('picture')).toHaveCSS('width', '128px');
});

When('I apply 125 percent zoom', async ({ page }) => {
  await page.getByTestId('zoom_toggle').click();
  await page.getByTestId('zoom_custom').fill('125');
  await page.getByTestId('zoom_custom').press('Enter');
});

Then('the image is displayed at custom size', async ({ page }) => {
  await expect(page.getByTestId('picture')).toHaveCSS('width', '80px');
});

When('I open the edit panel', async ({ page }) => {
  await page.getByTestId('edit_toggle').click();
});

Then('the edit controls are available', async ({ page }) => {
  await expect(page.getByTestId('edit_notice')).toContainText('salvando una copia');
  await expect(page.getByTestId('image_sidebar')).toHaveCSS('opacity', '1');

  await page.screenshot({ animations: 'disabled', path: 'test-results/viewer-edit.png' });
});

When('I adjust brightness and reset', async ({ page }) => {
  await page.getByTestId('edit_modify').click();
  await page.getByTestId('edit_brightness').fill('55');

  await expect(page.getByTestId('edit_brightness')).toHaveValue('55');

  await page.getByTestId('edit_reset').click();

  await expect(page.getByTestId('edit_brightness')).toHaveValue('0');
});

Then('the original image is still displayed', async ({ page }) => {
  await expect(page.getByTestId('picture')).toHaveAttribute('alt', first);
});

When('I choose the light theme and English', async ({ page }) => {
  await page.goto('/?theme=light&lang=en');
});

Then('the viewer uses the light theme and English', async ({ page }) => {
  await expect(page.getByTestId('empty_state')).toContainText('No image open');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  await page.screenshot({ animations: 'disabled', path: 'test-results/viewer-light.png' });
});

When('I navigate and open details with the keyboard', async ({ page }) => {
  await page.keyboard.press('ArrowRight');

  await expect(page.getByTestId('info_toggle')).toBeEnabled();
  await expect(page.getByTestId('picture')).toHaveAttribute('alt', second);

  await page.keyboard.press('i');

  await expect(page.getByTestId('image_sidebar')).toBeVisible();
});

When('I press Escape', async ({ page }) => {
  await page.keyboard.press('Escape');
});

Then('the side panel is closed', async ({ page }) => {
  await expect(page.getByTestId('image_sidebar')).toHaveCount(0);
});

When('I use a compact window', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 480 });
});

Then('the compact panel is scrollable and can be closed', async ({ page }) => {
  await expect(page.getByTestId('image_sidebar')).toBeVisible();

  await page.getByTestId('edit_reset').scrollIntoViewIfNeeded();
  await page.getByTestId('edit_reset').click();
  await page.screenshot({ animations: 'disabled', path: 'test-results/viewer-compact.png' });
  await page.getByTestId('panel_close').click();

  await expect(page.getByTestId('image_sidebar')).toHaveCount(0);
});
