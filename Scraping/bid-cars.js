const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

const getTimestamp = (dateStr) => {
    // Extract the timezone offset
    const timezoneMatch = dateStr.match(/GMT([+-]\d+)/);
    const timezoneOffset = timezoneMatch ? parseInt(timezoneMatch[1]) : 0;

    // Convert the date string to a format JavaScript can parse
    const formattedDateStr = dateStr.replace(/^\w{3} /, '') // Remove "Thu "
        .replace(',', ''); // Remove the comma

    // Create a Date object in UTC
    const date = new Date(formattedDateStr + ' UTC');

    // Adjust for timezone offset
    const timestampInSeconds = Math.floor(date.getTime() / 1000) - timezoneOffset * 3600;

    return timestampInSeconds;
}

(async () => {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    const url = 'https://bid.cars/en/search/results?search-type=filters&status=All&type=Automobile&make=Audi&model=All&year-from=2020&year-to=2026&auction-type=All';
    await page.goto(url, { waitUntil: 'networkidle2' });

    async function delay(time) {
        return new Promise(resolve => setTimeout(resolve, time));
    }

    const totalSearchCount = await page.evaluate(() => {
        const countElement = document.querySelector('a[data-value="All"] span.search-count');
        return countElement ? parseInt(countElement.innerText.replace(/\D/g, ''), 10) : 0;
    });

    console.log(`Total search count: ${totalSearchCount}`);

    async function loadAllResults() {
        let currentCount = 0;

        while (currentCount < totalSearchCount) {
            try {
                const loadMoreBtn = await page.$('div.breadcrumbs.load-more a.btn-primary');
                if (!loadMoreBtn) {
                    console.log('No more "Load More" button found.');
                    break;
                }
                await page.evaluate(el => el.click(), loadMoreBtn);
                console.log('Clicked Load More...');
                
                await delay(5000);
                
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

    const carData = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('div.item-horizontal.lots-search')).map(item => {
            const titleElement = item.querySelector('a.item-title');
            const title = titleElement ? titleElement.innerText.trim() : 'Unknown Title';
            const link = titleElement ? titleElement.href : '#';

            const vinElement = item.querySelector('span.vin_title');
            const vin = vinElement ? vinElement.innerText.trim() : 'Unknown VIN';

            const yearMatch = title.match(/\b(19|20)\d{2}\b/);
            const year = yearMatch ? yearMatch[0] : 'Unknown Year';

            const titleParts = title.split(' ');
            const make = titleParts.length > 1 ? titleParts[1].toUpperCase() : 'Unknown Make';
            const model = titleParts.length > 2 ? titleParts[2] : 'Unknown Model';
            
            const auctionStartElement = item.querySelector('.item-price .date');
            const auctionStartDateStr = auctionStartElement ? auctionStartElement.innerText.replace(/\n/g, ' ').trim() : 'Unknown Start Date';
            const auctionStartDate = getTimestamp(auctionStartDateStr);
            
            const auctionStatusElement = item.querySelector('.item-price .bid-status');
            const auctionStatus = auctionStatusElement ? auctionStatusElement.innerText.trim() : 'Unknown Status';
            
            const priceElement = item.querySelector('.item-price .price-box');
            const price = priceElement ? priceElement.innerText.replace('Final bid:', '').trim() : 'Unknown Price';
            
            // Print each car's information
            console.log(`
                Title: ${title}
                Make: ${make}
                Year: ${year}
                Model: ${model}
                VIN: ${vin}
                Auction Start Date: ${auctionStartDate}
                Auction Status: ${auctionStatus}
                Price: ${price}
                Link: ${link}
            `);

            return { title, make, year, model, link, vin, auctionStartDate, auctionStatus, price };
        });
    });

    if (carData.length > 0) {
        // console.log('Scraped Data:', carData);
        fs.writeFileSync('car_data_bidcars.json', JSON.stringify(carData, null, 2));
        console.log('Data saved as car_data_bidcars.json');
    } else {
        console.log('No car data found!');
    }

    await browser.close();
})();
