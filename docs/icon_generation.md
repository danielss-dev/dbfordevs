# Application Icon Generation Guide

This guide explains how to update and regenerate application icons for **dbfordevs** across all supported platforms (macOS, Windows, Linux, iOS, and Android).

## Prerequisites

- **Deno**: Used to run the Tauri CLI.
- **ImageMagick**: Required if you need to perform advanced image manipulation (like adding rounded corners or padding).
- **Tauri CLI**: Installed as a dev dependency in the project.

## Standard Icon Generation

To generate the full set of icons from a single source image (standard 1024x1024 PNG with transparency), use the following command:

```bash
deno run -A npm:@tauri-apps/cli icon <path-to-your-logo.png>
```

This will automatically update all files in `src-tauri/icons/`.

## Generating macOS-Style (Rounded) Icons

MacOS icons typically follow a "squircle" shape with specific padding. If your source logo is a full-bleed square, you can use **ImageMagick** to scale and round it before generating the final set:

### 1. Create the rounded source
The following command scales the logo to the standard macOS size (824px), adds transparent padding to reach 1024px, and applies the squircle rounding:

```bash
magick <source_logo.png> -resize 824x824 -background none -gravity center -extent 1024x1024 \
\( -size 1024x1024 xc:black -fill white -draw "roundrectangle 100,100 924,924 144,144" \) \
-alpha off -compose copy_opacity -composite src-tauri/icons/icon_rounded.png
```

### 2. Generate icons from the rounded source
```bash
deno run -A npm:@tauri-apps/cli icon src-tauri/icons/icon_rounded.png
```

### 3. Clean up
```bash
rm src-tauri/icons/icon_rounded.png
```

## Configuration

The icons are registered in `src-tauri/tauri.conf.json`:

```json
"bundle": {
  "icon": [
    "icons/32x32.png",
    "icons/128x128.png",
    "icons/128x128@2x.png",
    "icons/icon.icns",
    "icons/icon.ico"
  ]
}
```

## Troubleshooting

- **macOS Icon Cache**: macOS caches icons heavily. If you don't see changes in the Dock or Alt-Tab switcher, try running `killall Dock` or clearing the icon services cache:
  ```bash
  sudo find /private/var/folders/ -name com.apple.dock.iconcache -exec rm {} +
  sudo find /private/var/folders/ -name com.apple.iconservices -exec rm -rf {} +
  killall Dock; killall Finder
  ```

