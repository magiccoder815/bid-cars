from playwright.sync_api import sync_playwright
import time

def delay(seconds):
    time.sleep(seconds)

def load_all_results(page):
    while True:
        try:
            # Check if "Load More" button exists
            load_more_btn = page.query_selector('div.breadcrumbs.load-more a.btn-primary')
            if not load_more_btn:
                print('No more "Load More" button found.')
                break

            # Click the button in a human-like way
            load_more_btn.click()
            print('Clicked Load More...')

            delay(5)  # Wait for new content to load
        except Exception as e:
            print(f'An error occurred: {e}')
            break

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)
    page = browser.new_page()
    page.set_viewport_size({"width": 1280, "height": 800})

    page.goto('https://bid.cars/en/search/results?search-type=filters&status=All&type=Automobile&make=Audi&model=All&year-from=2018&year-to=2026&auction-type=All')

    load_all_results(page)

    # Scrape all item titles
    titles = page.eval_on_selector_all('div.item-horizontal.lots-search a.item-title', 'elements => elements.map(el => el.innerText.trim())')

    print('Scraped Titles:', titles)

    browser.close()
