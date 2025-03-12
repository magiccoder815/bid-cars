const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Target URL
    const url = 'https://bid.cars/en/search/results?search-type=filters&status=All&type=Automobile&make=Audi&model=All&year-from=2018&year-to=2026&auction-type=All';
    await page.goto(url, { waitUntil: 'networkidle2' });

    async function delay(time) {
        return new Promise(resolve => setTimeout(resolve, time));
    }

    // Get total number of search results
    const totalSearchCount = await page.evaluate(() => {
        const countElement = document.querySelector('a[data-value="All"] span.search-count');
        return countElement ? parseInt(countElement.innerText.replace(/\D/g, ''), 10) : 0;
    });

    console.log(`Total search count: ${totalSearchCount}`);

    async function loadAllResults() {
        let currentCount = 0;

        while (currentCount < totalSearchCount) {
            try {
                // Find "Load More" button
                const loadMoreBtn = await page.$('div.breadcrumbs.load-more a.btn-primary');
                if (!loadMoreBtn) {
                    console.log('No more "Load More" button found.');
                    break;
                }

                // Click the button
                await page.evaluate(el => el.click(), loadMoreBtn);
                console.log('Clicked Load More...');
                
                await delay(5000); // Wait for new items to load

                // Update count
                currentCount = await page.evaluate(() => 
                    document.querySelectorAll('div.item-horizontal.lots-search a.item-title').length
                );

                console.log(`Current loaded items: ${currentCount}`);
            } catch (error) {
                console.log('Error occurred:', error);
                break;
            }
        }
    }

    await loadAllResults();

    // Scrape car details
    const carData = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('div.item-horizontal.lots-search')).map(item => {
            const titleElement = item.querySelector('a.item-title');
            const title = titleElement ? titleElement.innerText.trim() : 'Unknown Title';
            const link = titleElement ? titleElement.href : '#';

            const vinElement = item.querySelector('span.vin_title');
            const vin = vinElement ? vinElement.innerText.trim() : 'Unknown VIN';

            // Extract Year (first four-digit number in title)
            const yearMatch = title.match(/\b(19|20)\d{2}\b/);
            const year = yearMatch ? yearMatch[0] : 'Unknown Year';

            // Extract Make (second word in the title)
            const titleParts = title.split(' ');
            const make = titleParts.length > 1 ? titleParts[1].toUpperCase() : 'Unknown Make';

            // Extract Model (third word in the title, if available)
            const model = titleParts.length > 2 ? titleParts[2] : 'Unknown Model';
            console.log(`  Title: ${title}`);
            console.log(`  Make: ${make}`);
            console.log(`  Year: ${year}`);
            console.log(`  Model: ${model}`);
            console.log(`  VIN: ${vin}`);
            console.log(`  Link: ${link}`);
            return { Title: title, Make: make, Year: year, Model: model, Link: link, Vin: vin };
        });
    });

    if (carData.length > 0) {
        console.log('Scraped Data:', carData);
        fs.writeFileSync('car_data_bidcars.json', JSON.stringify(carData, null, 2));
        console.log('Data saved as car_data_bidcars.json');
    } else {
        console.log('No car data found!');
    }

    await browser.close();
})();
