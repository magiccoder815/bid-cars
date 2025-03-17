const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const makes = ["ROLLS-ROYCE"];
const baseUrl =
    "https://www.copart.com/lotSearchResults?free=true&query=&searchCriteria=%7B%22query%22:%5B%22*%22%5D,%22filter%22:%7B%22MAKE%22:%5B%22lot_make_desc:%5C%22{make}%5C%22%22%5D,%22YEAR%22:%5B%22lot_year:%5B2020%20TO%202025%5D%22%5D%7D,%22watchListOnly%22:false,%22freeFormSearch%22:false%7D";

(async () => {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    for (const make of makes) {
        const makeFolder = make.replace(" ", "_");
        fs.mkdirSync(makeFolder, { recursive: true });

        const encodedMake = encodeURIComponent(make);
        const url = baseUrl.replace("{make}", encodedMake);

        await page.goto(url, { waitUntil: "networkidle2" });

        const totalResults = await page.$eval(
            "h3.text-black span.blue-heading",
            (el) => {
                return parseInt(el.innerText.replace(",", ""));
            }
        );
        const lastPageNumber = Math.ceil(totalResults / 100);

        // Wait for dropdown and select 100
        await page.waitForSelector(".p-paginator-rpp-options");
        await page.click(".p-paginator-rpp-options");
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Use Promise for delay
        await page.click("li[aria-label='100']");
        await new Promise((resolve) => setTimeout(resolve, 5000)); // Use Promise for delay

        const allCarData = [];

        const scrapePage = async (pageNumber) => {
            const cars = await page.$$(
                "tr.p-element.p-selectable-row.ng-star-inserted"
            );
            const carData = [];

            for (const car of cars) {
                try {
                    const titleElement = await car.$(
                        "span.search_result_lot_detail"
                    );
                    const title = await titleElement.evaluate((el) =>
                        el.innerText.trim()
                    );

                    const linkElement = await car.$(
                        "a[aria-label='Lot Details']"
                    );
                    const carLink = await linkElement.evaluate((el) => el.href);

                    const titleParts = title.split(" ");
                    const year = titleParts[0];

                    let model = title.replace(year, "").trim();

                    // Check if the make exists in the title
                    if (!title.includes(make)) {
                        // Check for spaces or dashes in the make
                        if (make.includes(" ")) {
                            // Replace " " with "-"
                            const modifiedMake = make.replace(" ", "-").trim();
                            model = model.replace(modifiedMake, "").trim();
                        } else if (make.includes("-")) {
                            // Replace "-" with " "
                            const modifiedMake = make.replace("-", " ").trim();
                            model = model.replace(modifiedMake, "").trim();
                        }
                    } else {
                        // If make exists in the title, remove it
                        model = model.replace(make, "").trim();
                    }

                    const bidElement = await car.$(
                        "span.search_result_amount_block.text-black.p-bold"
                    );
                    let currentBid = null;

                    if (bidElement) {
                        const amountElement = await bidElement.$(
                            "span.currencyAmount"
                        );
                        const currencyElement = await bidElement.$(
                            "span.currencyCode"
                        );

                        const amountText = await amountElement.evaluate((el) =>
                            el.innerText.trim()
                        );
                        const currencyText = await currencyElement.evaluate(
                            (el) => el.innerText.trim()
                        );
                        const amountValue = parseFloat(
                            amountText.replace(/[^\d.]/g, "")
                        );

                        currentBid = {
                            Currency: currencyText,
                            Amount: amountValue,
                        };
                    }

                    const carInfo = {
                        Title: title,
                        Make: make,
                        Year: year,
                        Model: model,
                        Link: carLink,
                        Current_Bid: currentBid,
                    };
                    carData.push(carInfo);
                    // console.log(JSON.stringify(carInfo, null, 4));
                } catch (error) {
                    console.log("Some elements were not found for this entry.");
                }
            }

            const filename = path.join(
                makeFolder,
                `car_data_page_${pageNumber}.json`
            );
            fs.writeFileSync(filename, JSON.stringify(carData, null, 4));
            return carData;
        };

        // Scrape the first page
        await scrapePage(1);

        for (let currentPage = 1; currentPage < lastPageNumber; currentPage++) {
            try {
                const nextButton = await page.$("button.p-paginator-next");
                const isDisabled = await page.evaluate(
                    (el) => el.classList.contains("p-disabled"),
                    nextButton
                );
                if (isDisabled) break;

                await nextButton.click();
                await new Promise((resolve) => setTimeout(resolve, 5000));
                await scrapePage(currentPage + 1);
            } catch (error) {
                break;
            }
        }

        console.log(`✅ All data saved in folder '${makeFolder}'`);
    }

    await browser.close();
})();
