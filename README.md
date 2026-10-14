# nas-picture-manager

External application for the NAS launcher, with a Vue 3/TypeScript interface and a Rust/Axum
backend. It views and edits images; its standalone package can be installed by the launcher.

- Opening NAS files through the Explorer picker, with an image filter, multiple selection and navigation with buttons and keyboard.
- Dragging images from the PC; browser selection available in standalone development.
- Fit zoom, preset percentages and custom zoom from 10% to 400%.
- Details with size, format, alpha channel, weight and last modification when available.
- Graphic or numeric crop, rotation, flip, brightness, contrast and sharpness.
- Annotations with shapes, lines, texts, pen and highlighter; undo and redo.
- Preview and download of a PNG, JPEG, WebP copy or one in the original format.
- Theme, accent, palette and Italian/English language received from the launcher, also while in use.

## Local start

Requires Node.js 24, pnpm and Rust/Cargo.

```bash
pnpm install
pnpm run backend:dev
```

In a second terminal:

```bash
pnpm run dev
```

Vite serves the UI on `http://127.0.0.1:1420/` and forwards `api/...` to the backend on the Unix
socket. `NAS_APP_SOCKET` changes the socket for both processes. The backend also serves the UI
built with `pnpm run build`, using `NAS_UI_DIR` or the `dist/` directory relative to the installed
binary.

In standalone mode, `?theme=light&lang=en` sets the initial look. The accepted values are
`theme=light|dark` and `lang=it|en`; the defaults are `dark` and `it`. Inside the launcher, the
messages of the shell update these choices. There are no local theme or language selectors.

In the launcher, **Open file** and `Ctrl+O` open the simplified view of Explorer. Cancelling keeps
the current image; if Explorer is not available an error is shown. The NAS protocol allows up to
100 files per selection.

## Formats and limits

PNG, JPEG, WebP, GIF, BMP, TIFF and ICO. At most 30 MiB, 100 megapixels and 16,384 pixels per side,
up to 500 selected files. The decoder has a budget of 512 MiB; WebP metadata of 4 MiB. Previews are
reduced to 2048 pixels per side, while editing and export keep the original resolution. Heavy
processing happens one job at a time, with a cache for the current image only up to 256 MiB.
Stale preview answers are ignored.

For animated or multi-page images the first frame or page is shown. The EXIF orientation is applied
at opening. The NAS picker lets the user choose images in the volumes Explorer is allowed to read.
The file is read when it is viewed; the logical path of the folder is shown in the details. Creation
date and last NAS modification are not provided by the selection protocol. In standalone mode, the
browser selection lets the user scroll through the chosen files without reaching the other files of
the folder; folder and creation date are not available.

## Editing and saving

Open **Edit**, apply the adjustments and choose **Save a copy**, also with `Ctrl+S` or `Cmd+S`: the
copy is downloaded and the original stays unchanged. Changing image or leaving Edit with unsaved
changes asks for confirmation. Closing or reloading the page uses the standard confirmation of the
browser. **Reset** goes back to the original and also removes the annotations.

The proposed format follows that of the opened image. PNG, JPEG and WebP can always be chosen;
**Original** uses the source format, GIF, BMP, TIFF or ICO included. The adjustments and Reset keep
the choice made for the current image. PNG and WebP keep transparency; JPEG uses a white background
and quality 92. The copies are static and do not keep the EXIF/ICC metadata.

The crop is drawn on the image or entered in pixels, with preset proportions. Rotation and flip
reset a crop already applied. Brightness, contrast and sharpness stay applied when moving to
another tool and work at 8 bits per channel.

**Draw** opens the annotation tools. Shift constrains the rectangle to a square; circles keep their
proportions. Text is inserted with a click and can be edited after insertion. Colour, thickness,
opacity and fill apply to the selection or to new notes. A click selects a note to move or resize
it; the arrows move by 1 pixel, Shift by 10. Pen and highlighter can be moved. Undo/Redo, `Ctrl+Z`
and `Ctrl+Y` act on the annotations; Delete or Backspace remove the selection outside text fields.

Annotations follow rotation, flip and crop; the photographic adjustments do not change their
colours. The exported copy embeds them in its pixels. Up to 200 objects, 20,000 points in total and
2,000 characters per text are allowed, with a history of 50 operations.

For structure, API, tests and conventions see [DEVELOPMENT.md](DEVELOPMENT.md). The contract with
the launcher is in [APPS.md](APPS.md); packaging and release are in [NAS.md](NAS.md).
