from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto("https://example.com")
    print("Title:", page.title())
    print("H1 text:", page.text_content("h1"))
    browser.close()
