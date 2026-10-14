import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { Given, Then } = createBdd();

Given('I open the viewer with parameters {string}', async ({ page }, parameters: string) => {
  await page.goto(`/${parameters}`);
});

Then(
  'the browser theme is {string} and language is {string}',
  async ({ page }, theme: string, language: string) => {
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page.locator('html')).toHaveAttribute('lang', language);
    await expect(page.getByTestId('open_images')).toHaveText(
      language === 'en' ? 'Open file' : 'Apri file',
    );
  },
);

Then('desktop settings are absent from the options menu', async ({ page }) => {
  await page.getByTestId('options_toggle').click();

  for (const id of ['fullscreen_toggle', 'theme_light', 'theme_dark', 'locale_select']) {
    await expect(page.getByTestId(id)).toHaveCount(0);
  }

  await page.getByTestId('options_toggle').click();
});
