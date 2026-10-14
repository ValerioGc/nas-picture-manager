import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { readFileSync } from 'node:fs';

const { Given, When, Then } = createBdd();
const fixture = readFileSync('src/tests/e2e/fixtures/colors.png');

Given('I open the viewer inside the NAS shell', async ({ page }) => {
  await page.route('**/apps/nas-file-manager/api/downloads?path=*', (route) =>
    route.fulfill({ contentType: 'image/png', body: fixture }),
  );
  await page.route('**/nas-theme-shell', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html><body>
      <iframe title="Picture Manager" src="/?theme=dark&lang=it" style="width:100%;height:90vh"></iframe>
      <script>
        addEventListener('message', (event) => {
          const frame = document.querySelector('iframe');
          if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
          if (event.data?.type === 'pick-files') {
            window.pickerOptions = event.data;
            const mode = document.body.dataset.picker;
            frame.contentWindow.postMessage({
              nas: 1, type: 'pick-files-result', requestId: event.data.requestId,
              files: mode ? [] : [{ name: 'palette.png', path: '/photos/palette.png', url: new URL('/apps/nas-file-manager/api/downloads?path=photos%2Fpalette.png', location.origin).href }],
              cancelled: mode === 'cancel', ...(mode === 'error' ? { error: 'Explorer unavailable' } : {})
            }, location.origin);
            return;
          }
          if (event.data?.type !== 'ready') return;
          frame.contentWindow.postMessage({
            nas: 1, type: 'context', context: {
              app: 'nas-picture-manager', theme: 'light', locale: 'en', accent: '#663399',
              palette: { background: '#edf0f8', foreground: '#24304a', surface: '#fafbfe', sunken: '#e2e6f0', hover: '#ccd2e0', border: '#a8b0c4', muted: '#62708b' }
            }
          }, location.origin);
        });
      </script>
    </body></html>`,
    }),
  );
  await page.goto('/nas-theme-shell');
});

Then('the viewer follows the light launcher palette and English', async ({ page }) => {
  const viewer = page.frameLocator('iframe');
  await expect(viewer.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(viewer.locator('html')).toHaveAttribute('lang', 'en');
  await expect(viewer.locator('html')).toHaveCSS('--nas-background', '#edf0f8');
  await expect(viewer.locator('body')).toHaveCSS('color', 'rgb(36, 48, 74)');
  await expect(viewer.getByTestId('open_images')).toHaveCSS(
    'background-color',
    'rgb(102, 51, 153)',
  );
});

When('I open an image in the NAS frame', async ({ page }) => {
  await page.frameLocator('iframe').getByTestId('open_images').click();
  await expect(page.frameLocator('iframe').getByTestId('picture')).toBeVisible();
});

When('I request a NAS image with the open shortcut', async ({ page }) => {
  const open = page.frameLocator('iframe').getByTestId('open_images');
  await expect(open).toBeVisible();
  await open.focus();
  await page.keyboard.press('Control+o');
});

Then(
  'the image comes from the NAS with image filters and no local file chooser',
  async ({ page }) => {
    const viewer = page.frameLocator('iframe');
    await expect(viewer.getByTestId('picture')).toHaveAttribute('alt', 'palette.png');
    await expect(viewer.getByTestId('file_input')).toHaveCount(0);
    expect(
      await page.evaluate(
        () =>
          (window as typeof window & { pickerOptions: { multiple: boolean; extensions: string[] } })
            .pickerOptions,
      ),
    ).toMatchObject({
      multiple: true,
      extensions: ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tif', '.tiff', '.ico'],
    });
  },
);

When('I cancel the next NAS selection', async ({ page }) => {
  await page.evaluate(() => {
    document.body.dataset.picker = 'cancel';
  });
  const viewer = page.frameLocator('iframe');
  await viewer.getByTestId('options_toggle').click();
  await viewer.getByTestId('options_open').click();
});

When('Explorer is unavailable for the next selection', async ({ page }) => {
  await page.evaluate(() => {
    document.body.dataset.picker = 'error';
  });
  const viewer = page.frameLocator('iframe');
  await viewer.getByTestId('options_toggle').click();
  await viewer.getByTestId('options_open').click();
});

Then('the NAS image stays open without an error', async ({ page }) => {
  const viewer = page.frameLocator('iframe');
  await expect(viewer.getByTestId('picture')).toHaveAttribute('alt', 'palette.png');
  await expect(viewer.getByRole('alert')).toHaveCount(0);
});

Then('an Explorer error is shown and the NAS image stays open', async ({ page }) => {
  const viewer = page.frameLocator('iframe');
  await expect(viewer.getByRole('alert')).toContainText('Explorer');
  await expect(viewer.getByTestId('picture')).toHaveAttribute('alt', 'palette.png');
  await expect(viewer.getByTestId('file_input')).toHaveCount(0);
});

When('the launcher selects a different dark palette and Italian', async ({ page }) => {
  await page.evaluate(() => {
    document.querySelector('iframe')?.contentWindow?.postMessage(
      {
        nas: 1,
        type: 'context',
        context: {
          app: 'nas-picture-manager',
          theme: 'dark',
          locale: 'it',
          accent: '#ffbb66',
          palette: {
            background: '#252738',
            foreground: '#e3e7ff',
            surface: '#303449',
            sunken: '#1c2030',
            hover: '#44485e',
            border: '#626782',
            muted: '#aaafcb',
          },
        },
      },
      location.origin,
    );
  });
});

Then('the viewer follows the dark launcher palette and keeps the image', async ({ page }) => {
  const viewer = page.frameLocator('iframe');
  await expect(viewer.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(viewer.locator('html')).toHaveAttribute('lang', 'it');
  await expect(viewer.locator('html')).toHaveCSS('--nas-background', '#252738');
  await expect(viewer.locator('body')).toHaveCSS('color', 'rgb(227, 231, 255)');
  await expect(viewer.getByTestId('picture')).toHaveAttribute('alt', 'palette.png');
  await expect(viewer.getByTestId('file_name')).toHaveText('palette.png');
  await viewer.getByTestId('info_toggle').click();
  await expect(viewer.getByTestId('image_sidebar')).toHaveCSS(
    'background-color',
    'rgb(48, 52, 73)',
  );
  await expect(viewer.getByTestId('image_sidebar')).toContainText('Dettagli immagine');
});

When('the launcher clears the palette and accent', async ({ page }) => {
  await page.evaluate(() => {
    document.querySelector('iframe')?.contentWindow?.postMessage(
      {
        nas: 1,
        type: 'context',
        context: {
          app: 'nas-picture-manager',
          theme: 'dark',
          locale: 'it',
          accent: '',
          palette: {},
        },
      },
      location.origin,
    );
  });
});

Then('the viewer uses the local dark palette and keeps the image', async ({ page }) => {
  const viewer = page.frameLocator('iframe');
  await expect(viewer.locator('html')).toHaveCSS('--nas-background', '#172027');
  await expect(viewer.getByTestId('picture')).toHaveAttribute('alt', 'palette.png');
});
