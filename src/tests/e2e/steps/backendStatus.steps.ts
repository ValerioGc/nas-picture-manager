import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { When, Then } = createBdd();

When('I open a damaged image', async ({ page }) => {
  await page.getByTestId('file_input').setInputFiles({
    name: 'broken.png',
    mimeType: 'image/png',
    buffer: Buffer.from('invalid image data'),
  });
});

Then('an image error is reported', async ({ page }) => {
  await expect(page.getByRole('alert')).toContainText('non è supportato');
  await expect(page.getByTestId('picture')).toHaveCount(0);
  await expect(page.getByRole('alert').getByRole('heading')).toHaveText(
    'Errore durante il caricamento dell’immagine',
  );
  await expect(page.getByRole('alert').getByRole('button')).toHaveText('Apri un’altra immagine');
  await expect(page.getByTestId('image_position')).toHaveCount(0);

  await page.screenshot({ path: 'test-results/viewer-error.png' });
});
