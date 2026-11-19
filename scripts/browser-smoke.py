"""Browser smoke test against the real deployed app. No fixture API responses.
Set TEST_URL; optionally QA_A_EMAIL / QA_A_PASSWORD for authenticated checks.
LIVE_HTTP_RELAY=1 uses Python's HTTP transport where Chromium egress is restricted.
"""
import os, json, urllib.request, urllib.error
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
BASE=os.environ['TEST_URL'].rstrip('/')+'/'
OUT=Path('.checks');(OUT/'exports').mkdir(parents=True, exist_ok=True)

def live_transport(route):
    req=route.request
    host=urlparse(req.url).hostname
    if host not in (urlparse(BASE).hostname, 'www.designarena.ai', 'cdn.jsdelivr.net') and not (host or '').endswith('.supabase.co'):
        route.abort();return
    headers={k:v for k,v in req.all_headers().items() if k.lower() not in ('host','connection','accept-encoding','content-length')}
    headers['Accept-Encoding']='identity'
    try:
        try: response=urllib.request.urlopen(urllib.request.Request(req.url,data=req.post_data_buffer,headers=headers,method=req.method),timeout=30)
        except urllib.error.HTTPError as e: response=e
        with response as resp:
            body=resp.read();h={k:v for k,v in resp.headers.items() if k.lower() not in ('connection','transfer-encoding','content-length')}
            route.fulfill(status=resp.status,headers=h,body=body)
    except Exception as e:
        print('Transport issue:',host,type(e).__name__,flush=True);route.abort()

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,args=['--no-sandbox']);ctx=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True)
    if os.environ.get('LIVE_HTTP_RELAY')=='1':ctx.route('**/*',live_transport)
    page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));r=page.goto(BASE,wait_until='domcontentloaded',timeout=45000);page.locator('h1').wait_for();page.evaluate('document.fonts.ready');page.wait_for_timeout(350)
    print('Production home:',r.status,page.title(),flush=True);page.screenshot(path=str(OUT/'desktop-live.png'));page.get_by_role('link',name='View sample report',exact=True).click();page.get_by_role('heading',name='Sleep, learning & memory').wait_for(timeout=30000);assert page.locator('.claim-card').count()==6
    page.locator('.tab-bar button').filter(has_text='Source checks').click();assert page.locator('.audit-row').count()==6;print('PASS: complete source audit',flush=True);page.locator('.tab-bar button').filter(has_text='Claims').click();page.get_by_label('Filter verdicts').select_option('Possibly Outdated');assert page.locator('.claim-card').count()==1
    for fmt,selector,extension in [('PDF','PDF report','pdf'),('DOCX','Word document','docx'),('Excel','Excel workbook','xlsx'),('CSV','CSV file','csv')]:
        page.get_by_role('button',name='Export report',exact=True).click();page.locator('.format-option').filter(has_text=selector).click()
        with page.expect_download(timeout=40000) as info:page.get_by_role('link',name='Download '+fmt+' report',exact=True).click()
        dest=OUT/'exports'/('full-review.'+extension);info.value.save_as(str(dest));assert dest.stat().st_size>2000;print('PASS: export',fmt,dest.stat().st_size,'bytes',flush=True)
    page.get_by_label('Filter verdicts').select_option('All verdicts');page.screenshot(path=str(OUT/'report-live.png'));page.goto(BASE+'#/library');page.locator('.source-card').first.wait_for();page.get_by_role('button',name='View abstract').first.click();assert page.locator('.abstract-block').is_visible();print('PASS: authentic source abstracts',flush=True)
    page.goto(BASE+'#/workspace');page.get_by_role('heading',name='Your research workspace.').wait_for();page.locator('.sample-banner').wait_for();assert page.locator('.dashboard-stats .stat-card').count()==4;assert not page.locator('.console-banner,.console-history,.console-footer,.signal-art,.source-card').count();print('PASS: first-version workspace layout and palette, without published paper listings',flush=True)
    if os.environ.get('QA_A_EMAIL'):
        page.get_by_role('link',name='Log in',exact=True).click()
        page.get_by_label('Email address',exact=True).fill(os.environ['QA_A_EMAIL']);page.get_by_label('Password',exact=True).fill(os.environ['QA_A_PASSWORD']);page.get_by_role('button',name='Sign in',exact=True).click();page.get_by_text('Verification history',exact=True).wait_for(timeout=30000);page.locator('.history-item').first.wait_for();print('PASS: password sign-in returns to authenticated cloud history',flush=True);page.screenshot(path=str(OUT/'workspace-live.png'))
        page.goto(BASE+'#/settings');page.get_by_role('button',name='dark',exact=True).click();page.get_by_role('button',name='Save changes').click();page.get_by_text('Profile and preferences saved',exact=True).wait_for();assert page.locator('html').get_attribute('data-theme')=='dark';page.get_by_role('button',name='light',exact=True).click();page.get_by_role('button',name='Save changes').click();page.wait_for_timeout(700);print('PASS: persistent theme and profile',flush=True);page.get_by_role('button',name='Sign out',exact=True).click();page.get_by_role('link',name='Log in',exact=True).wait_for()
    ctx.close();m=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True)
    if os.environ.get('LIVE_HTTP_RELAY')=='1':m.route('**/*',live_transport)
    mp=m.new_page();mp.goto(BASE,wait_until='domcontentloaded');mp.get_by_role('heading',level=1).wait_for();mp.evaluate('document.fonts.ready');mp.screenshot(path=str(OUT/'mobile-live.png'),full_page=True);assert mp.evaluate('document.documentElement.scrollWidth<=innerWidth');mp.get_by_role('button',name='Toggle navigation').click();mp.locator('.mobile-menu').get_by_role('link',name='Source library').click();mp.locator('.source-card').first.wait_for(timeout=25000);assert mp.evaluate('document.documentElement.scrollWidth<=innerWidth');print('PASS: mobile layout and navigation; JS exceptions:',errors,flush=True);assert not errors;browser.close()
