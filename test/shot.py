import sys, asyncio
from playwright.async_api import async_playwright
async def main(url, out, w=1500, h=1400):
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': w, 'height': h})
        msgs = []
        pg.on('console', lambda m: msgs.append(m.text))
        pg.on('pageerror', lambda e: msgs.append('ERR ' + str(e)))
        await pg.goto(url)
        await pg.wait_for_timeout(300)
        await pg.screenshot(path=out, full_page=True)
        for m in msgs: print(m)
        await b.close()
a = sys.argv
asyncio.run(main(a[1], a[2], int(a[3]) if len(a) > 3 else 1500, int(a[4]) if len(a) > 4 else 1400))
