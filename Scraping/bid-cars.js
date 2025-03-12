const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Use stealth mode to bypass bot detection
puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    await page.goto('https://bid.cars/en/search/results?search-type=filters&status=All&type=Automobile&make=Audi&model=All&year-from=2018&year-to=2026&auction-type=All', { waitUntil: 'networkidle2' });

    async function delay(time) {
        return new Promise(resolve => setTimeout(resolve, time));
    }

    async function loadAllResults() {
        while (true) {
            try {
                // Check if "Load More" button exists
                const loadMoreBtn = await page.$('div.breadcrumbs.load-more a.btn-primary');
                if (!loadMoreBtn) {
                    console.log('No more "Load More" button found.');
                    break;
                }

                // Click the button in a human-like way
                await page.evaluate(el => el.click(), loadMoreBtn);
                console.log('Clicked Load More...');
                
                await delay(5000); // Wait for new content to load
            } catch (error) {
                console.log('An error occurred:', error);
                break;
            }
        }
    }

    await loadAllResults();

    // Scrape all item titles
    const titles = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('div.item-horizontal.lots-search a.item-title'))
            .map(el => el.innerText.trim());
    });

    console.log('Scraped Titles:', titles);
    
    await browser.close();
})();
