import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { Given, Then } = createBdd();

Given('I open the application', async ({ page }) => {
  await page.goto('/');
});

Then('the page has a title', async ({ page }) => {
  await expect(page).toHaveTitle(/\S/);
});

Then('the home screen is minimal and fits the window', async ({ page }) => {
  const titlebar = page.getByTestId('titlebar');
  const home = page.getByTestId('empty_state');

  await expect(titlebar).toHaveCount(0);
  await expect(page.getByTestId('open_titlebar')).toHaveCount(0);
  await expect(home.getByRole('heading')).toHaveText('Nessuna immagine aperta');
  await expect(home.getByRole('button')).toHaveText('Apri file');
  await expect(home).not.toContainText('PNG');
  await expect(home.locator('svg')).toHaveCount(0);

  const viewer = await page.getByTestId('image_viewer').boundingBox();

  expect(viewer?.y).toBe(0);
  await expect(home).toContainText('trascinandole qui');
  await expect(page.getByTestId('zoom_toggle')).toHaveCount(0);
  expect((viewer?.y ?? 0) + (viewer?.height ?? 0)).toBe(page.viewportSize()?.height);

  await page.screenshot({ path: 'test-results/viewer-home.png' });
});
