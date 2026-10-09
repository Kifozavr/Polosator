import sys, asyncio, base64
from playwright.async_api import async_playwright
# renders every preset through the real app pipeline into a contact sheet
async def main():
    out, fmt, layout, theme, t = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], float(sys.argv[5])
    only = sys.argv[6] if len(sys.argv) > 6 else ''
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': 1400, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'TUNNEL' not in m.text else None)
        await pg.goto('file:///home/claude/pbonus/Polosator.html')
        await pg.wait_for_timeout(600)
        data = await pg.evaluate('''async ([fmt, layout, theme, t, only]) => {
          const pb = __pb; pb.setPlaying(false);
          const S = pb.S; S.fmt = fmt; S.layout = layout; if (layout === 'full') S.text.mode = 'none';
          const th = {violet:['#A872FF','#FFFFFF','#5A2BE0',['#76DEFE','#FFA3E9','#FFC568']], night:['#130D26','#FFFFFF','#221844',['#A872FF','#76DEFE','#FFA3E9']], white:['#FFFFFF','#16121F','#F0EAFF',['#A872FF','#5A2BE0','#FFA3E9']]}[theme];
          S.cols = {bg: th[0], ink: th[1], card: th[2], p: th[3].slice()}; S.theme = theme;
          const ids = only ? only.split(',') : PRESETS.map(p => p.id);
          const f = pb.fmt(); const cw = 420, ch = Math.round(cw * f.h / f.w);
          const cols = 3, rows = Math.ceil(ids.length / cols);
          const sheet = document.createElement('canvas'); sheet.width = cols * (cw + 8); sheet.height = rows * (ch + 26);
          const sx = sheet.getContext('2d'); sx.fillStyle = '#222'; sx.fillRect(0, 0, sheet.width, sheet.height);
          const c = document.createElement('canvas'); c.width = cw; c.height = ch;
          let i = 0;
          for (const id of ids) {
            pb.applyPreset(id);
            const t0 = performance.now();
            pb.renderTo(c, cw / f.w, t);
            const ms = performance.now() - t0;
            const x = (i % cols) * (cw + 8), y = Math.floor(i / cols) * (ch + 26);
            sx.drawImage(c, x, y); sx.fillStyle = '#ddd'; sx.font = '13px sans-serif'; sx.fillText(id + ' · ' + ms.toFixed(1) + 'ms', x + 4, y + ch + 17);
            i++;
          }
          return sheet.toDataURL('image/png');
        }''', [fmt, layout, theme, t, only])
        open(out, 'wb').write(base64.b64decode(data.split(',')[1]))
        for e in errs: print('ERR', e)
        await b.close()
asyncio.run(main())
