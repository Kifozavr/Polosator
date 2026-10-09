import sys, asyncio, json
from playwright.async_api import async_playwright
async def main():
    url = 'file:///home/claude/pbonus/Polosator.html'
    out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/claude-0/app.png'
    js = sys.argv[2] if len(sys.argv) > 2 else ''
    w = int(sys.argv[3]) if len(sys.argv) > 3 else 1500
    h = int(sys.argv[4]) if len(sys.argv) > 4 else 900
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': w, 'height': h})
        msgs = []
        pg.on('console', lambda m: msgs.append(m.type + ': ' + m.text))
        pg.on('pageerror', lambda e: msgs.append('PAGEERROR ' + str(e)))
        await pg.goto(url)
        await pg.wait_for_timeout(700)
        if js:
            r = await pg.evaluate('async () => {' + js + '}')
            if r is not None: print('JS:', json.dumps(r, ensure_ascii=False)[:3000])
            await pg.wait_for_timeout(400)
        await pg.screenshot(path=out)
        for m in msgs: print(m)
        await b.close()
asyncio.run(main())
