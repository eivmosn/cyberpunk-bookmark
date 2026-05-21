# Cyberpunk Bookmark

A cyberpunk-style Chrome new tab extension that turns browser bookmarks into a searchable visual dashboard.

![screenshot](./cover.png)

## Features

- Automatically reads Chrome bookmarks and groups them by folder.
- Displays category navigation, nested bookmark channels, and masonry bookmark cards.
- Supports global fuzzy search and current-category search.
- Includes favorite, recent, and frequent quick-access lanes.
- Tracks local open frequency and last-opened time for sorting.
- Provides compact, standard, and showcase density modes.
- Offers Chinese and English UI switching without changing user bookmark data.
- Handles empty bookmark libraries with a dedicated onboarding state.
- Supports opening links in a new tab, current tab, or new window, plus copy-link actions.
- Uses a cyberpunk HUD visual style with responsive desktop and mobile layouts.

## Development

Install dependencies:

```bash
pnpm install
```

Start the development server:

```bash
pnpm run dev
```

Run lint:

```bash
pnpm run lint
```

Auto-fix lint issues:

```bash
pnpm run lint:fix
```

Build the extension:

```bash
pnpm run build
```

The production extension files are generated in `dist/`.

## Install In Chrome

1. Run `pnpm run build`.
2. Open Chrome and go to `chrome://extensions/`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the generated `dist/` directory.
6. Open a new tab to use the dashboard.

The extension needs the Chrome `bookmarks` permission to read your bookmarks and the `favicon` permission to display site icons. It only reorganizes bookmarks for display; it does not edit your browser bookmarks.
