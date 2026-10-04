ENGCHAIN
© 2026 ENGCHAIN

## 本地演示服务

- **演示（带缓存，推荐）**：`python serve_cached.py [端口]`，默认 8767。
  - HTML：`no-cache`（改动即时可见，未变走 304）；css/js/图片等静态资源：`max-age=3600`，二次进入秒开。
  - 替换图片/文件后，请在引用处 URL 加 `?v=新版本号`（沿用现有习惯），避免缓存期内显示旧资源。
- **开发（无缓存）**：`python serve_nocache.py [端口]`，默认 8766。每次刷新全量重下，便于调试改动。

## 图片资源

- `python optimize_images.py`：按实际显示尺寸压缩 assets 中被引用的图片（就地覆盖，git 可回滚），
  报告输出到 `artifacts/image-optimization-report.json`；`--dry-run` 仅预览不写文件。
- `js/common.js` 内置全局图片失败兜底：弱网/断链时自动替换为内联 SVG 占位，不再出现破图。
