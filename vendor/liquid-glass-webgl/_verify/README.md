# Vendor verification

Proves the vendored `apple-liquid-glass-webgl` actually renders with **real WebGL2 refraction**
in this project — not the `backdrop-filter` fallback the library silently falls back to.

```bash
cd D:/Engchain3.0/vendor/liquid-glass-webgl
node _verify/run.cjs
```

No server needed — the script serves the package over `127.0.0.1:8791` itself, because ES
modules cannot be imported from `file://`.

## What it asserts

| Check | Expected |
|---|---|
| `LiquidGlass.isSupported()` | `true` |
| `mode` on every mounted surface | `'webgl'` (not `'fallback'`) |
| `data-liquid-glass` on the element | `'webgl'` |
| `DEFAULT_MATERIAL` keys | the **V2** set — `refraction`, `edgeReach`, … (17 params), **no** `squircle`/`ior`/`meniscus` |
| V1-only key `squircle` | throws `Unknown Liquid Glass V2 material parameter` |
| WebGL2 context cost | card 1, dock 1, switch 1, navbar 2, all four 5 |
| A mount that throws on a bad material | leaks **no** canvas |
| Page errors | none |

## Why `smoke.png` is the real proof

The backdrop is high-contrast stripes. `backdrop-filter: blur()` would **smear** them
uniformly. Real refraction **bends** them, compresses them toward the edges, and splits the
colour channels. If the stripes in `smoke.png` are curved, refraction is running; if they are
merely soft, you are looking at the fallback and every material value is inert.

## Headless WebGL

Chrome needs `--enable-gpu --use-gl=angle --enable-unsafe-swiftshader`. Without them headless
Chrome reports no WebGL2, `isSupported()` returns `false`, and everything falls back — which
looks exactly like a broken library.

## Measuring contexts honestly

Two false signals to avoid, both of which cost real debugging time here:

- **Canvas elements ≠ WebGL contexts.** A switch renders 3 `<canvas>` but costs 1 context; the
  other two are 2D capture layers.
- **`getContext` counts probes.** `isSupported()` creates a throwaway canvas and gets a
  `webgl2` context on it. Recording the canvas at creation and re-checking `canvas.isConnected`
  at the end excludes it correctly.

`run.cjs` does both. `<script>` at the top of `index.html` installs the hook before the module
loads; it only ever counts the **first** `getContext` per canvas, since the call is idempotent.

Files:

- `index.html` — the surface under test, plus the context-counting hook. `?only=card|dock|switch|nav|all|none` isolates one surface.
- `run.cjs` — HTTP server + headless Chrome driver, prints the context table.
- `smoke.png` — screenshot of all surfaces over the striped backdrop.
