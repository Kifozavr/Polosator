#!/usr/bin/env python3
"""Build Полосатор: inline vendor scripts, the brand font and the app into one page.
Outputs:
  Polosator.html      — standalone page, works offline (open in a browser)
  dist/artifact.html  — the same content without the <html> wrapper, for publishing
"""
import base64, json, pathlib, re
ROOT = pathlib.Path(__file__).resolve().parent
src = (ROOT / 'src/page.html').read_text(encoding='utf-8')
vendor = ''.join(f'<script>\n{(ROOT / "vendor" / n).read_text(encoding="utf-8")}\n</script>\n'
                 for n in ['opentype.min.js', 'gifenc.min.js', 'mp4-muxer.min.js', 'webm-muxer.min.js'])
fonts = {k: base64.b64encode((ROOT / f'fonts/F37Holborn-{n}.ttf').read_bytes()).decode()
         for k, n in [('light', 'Light'), ('regular', 'Regular'), ('medium', 'Medium')]}
fonts_js = '<script>\nconst FONT_DATA = ' + json.dumps(fonts) + ';\n</script>\n'
app = (ROOT / 'src/engine.js').read_text(encoding='utf-8') + '\n' + (ROOT / 'src/app.js').read_text(encoding='utf-8')
for bad in ['</script', '<!--']:
    if bad in app:
        raise SystemExit(f'src contains "{bad}", which would break the inline script')
page = src.replace('<!--VENDOR-->', vendor).replace('<!--FONTS-->', fonts_js).replace('<!--APP-->', '<script>\n' + app + '\n</script>')
(ROOT / 'dist').mkdir(exist_ok=True)
(ROOT / 'dist/artifact.html').write_text(page, encoding='utf-8')
full = ('<!doctype html><html lang="ru"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>\n'
        + page + '\n</body></html>\n')
(ROOT / 'Polosator.html').write_text(full, encoding='utf-8')
print(f'Polosator.html {len(full.encode()) / 1024:.0f} KB · dist/artifact.html {len(page.encode()) / 1024:.0f} KB')
