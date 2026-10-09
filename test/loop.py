import sys, asyncio, json
from playwright.async_api import async_playwright
# seam check: frame t=0 vs t=1 must match; also report where the helicoid pattern moves
async def main():
    ids = sys.argv[1].split(',')
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': 1200, 'height': 800})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file:///home/claude/pbonus/Polosator.html')
        await pg.wait_for_timeout(600)
        r = await pg.evaluate('''async (ids) => {
          const pb = __pb; pb.setPlaying(false); pb.S.layout = 'full'; pb.S.text.mode = 'none';
          const f = pb.fmt(), w = 480, h = Math.round(w * f.h / f.w), sc = w / f.w;
          const grab = t => { const c = document.createElement('canvas'); c.width = w; c.height = h; pb.renderTo(c, sc, t); return c.getContext('2d').getImageData(0, 0, w, h).data; };
          const out = {};
          for (const id of ids) {
            pb.applyPreset(id);
            const a = grab(0), z = grab(1), m = grab(0.999);
            let diff = 0, near = 0, cnt = 0, sum = 0;
            for (let i = 0; i < a.length; i += 4) { const d = Math.max(Math.abs(a[i] - z[i]), Math.abs(a[i+1] - z[i+1]), Math.abs(a[i+2] - z[i+2])); diff = Math.max(diff, d); sum += d; if (d > 8) cnt++; }
            for (let i = 0; i < a.length; i += 4) near += Math.abs(a[i] - m[i]);
            out[id] = { maxDiff_t0_t1: diff, px_over8: cnt, meanDiff_t0_t1: +(sum / (a.length / 4)).toFixed(3), meanDiff_t0_t0999: +(near / (a.length / 4)).toFixed(2) };
          }
          return out;
        }''', ids)
        print(json.dumps(r, ensure_ascii=False, indent=1))
        for e in errs: print('ERR', e)
        await b.close()
asyncio.run(main())
