const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");
const { v4: uuidv4 } = require("uuid");

// const StealthPlugin = require("puppeteer-extra-plugin-stealth");
// puppeteer.use(StealthPlugin());

const makes = [
    "AUDI",
    "BMW",
    "FERRARI",
    "LEXUS",
    "BENTLEY",
    "LAND ROVER",
    "ROLLS-ROYCE",
];

const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);

const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
const formattedYesterday = yesterday.toISOString().split("T")[0];

const baseUrl =
    "https://www.copart.com/lotSearchResults?free=true&query=&searchCriteria=%7B%22query%22:%5B%22*%22%5D,%22filter%22:%7B%22MAKE%22:%5B%22lot_make_desc:%5C%22{make}%5C%22%22%5D,%22YEAR%22:%5B%22lot_year:%5B2020%20TO%202025%5D%22%5D%7D,%22watchListOnly%22:false,%22freeFormSearch%22:false%7D";

(async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    for (const make of makes) {
        const makeFolder = make.replace(" ", "_");
        fs.mkdirSync(makeFolder, { recursive: true });

        const encodedMake = encodeURIComponent(make);
        const url = baseUrl.replace("{make}", encodedMake);

        await page.goto(url, { waitUntil: "networkidle2" });

        try {
            await page.waitForSelector("h3.text-black span.blue-heading", {
                timeout: 5000,
            });
            const totalResults = await page.$eval(
                "h3.text-black span.blue-heading",
                (el) => parseInt(el.innerText.replace(",", ""))
            );
            const lastPageNumber = Math.ceil(totalResults / 100);

            // Set items per page to 100
            await page.waitForSelector(".p-paginator-rpp-options", {
                timeout: 5000,
            });
            await page.click(".p-paginator-rpp-options");
            await new Promise((resolve) => setTimeout(resolve, 2000));
            await page.click("li[aria-label='100']");
            await new Promise((resolve) => setTimeout(resolve, 5000));

            const scrapePage = async (pageNumber) => {
                console.log(`Scraping page ${pageNumber}...`);

                await page.waitForSelector(
                    "tr.p-element.p-selectable-row.ng-star-inserted",
                    { timeout: 5000 }
                );

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
                        const link = await linkElement.evaluate(
                            (el) => el.href
                        );

                        const titleParts = title.split(" ");
                        const year = titleParts[0];
                        let model = title.replace(year, "").trim();

                        if (!title.includes(make)) {
                            if (make.includes(" ")) {
                                model = model
                                    .replace(make.replace(" ", "-").trim(), "")
                                    .trim();
                            } else if (make.includes("-")) {
                                model = model
                                    .replace(make.replace("-", " ").trim(), "")
                                    .trim();
                            }
                        } else {
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

                            const amountText = await amountElement.evaluate(
                                (el) => el.innerText.trim()
                            );
                            const currency = await currencyElement.evaluate(
                                (el) => el.innerText.trim()
                            );

                            const amount = parseFloat(
                                amountText.replace(/[^\d.]/g, "")
                            );
                            currentBid = {
                                currency,
                                amount,
                            };
                        }

                        // Open car detail page
                        const newPage = await browser.newPage();
                        await newPage.goto(link, {
                            waitUntil: "networkidle2",
                        });
                        await new Promise((resolve) =>
                            setTimeout(resolve, 1000)
                        );

                        let details = null;

                        const lotNumber = await newPage
                            .$eval("#LotNumber", (el) => el.innerText.trim())
                            .catch(() => "N/A");
                        const imageUrl = await newPage
                            .$eval("#media-lot-image", (img) => img.src)
                            .catch(() => "N/A");
                        const thumbnails = await newPage.$$eval(
                            ".p-galleria-thumbnail-item img",
                            (images) => images.map((img) => img.src)
                        );
                        const vin = await newPage
                            .$eval(
                                "label[for='VIN:'] + div .lot-details-desc",
                                (el) => el.innerText.trim()
                            )
                            .catch(() => "N/A");
                        const primaryDamage = await newPage
                            .$eval(
                                "[data-uname='lotdetailPrimarydamagevalue']",
                                (el) => el.innerText.trim()
                            )
                            .catch(() => "N/A");
                        const color = await newPage
                            .$eval("[data-uname='lotdetailColorvalue']", (el) =>
                                el.innerText.trim()
                            )
                            .catch(() => "N/A");
                        const transmission = await newPage.evaluate(() => {
                            const labels = Array.from(
                                document.querySelectorAll("label")
                            );
                            for (let label of labels) {
                                if (
                                    label.innerText.trim() === "Transmission:"
                                ) {
                                    const span = label.nextElementSibling;
                                    if (
                                        span &&
                                        span.classList.contains(
                                            "lot-details-desc"
                                        )
                                    ) {
                                        return span.innerText.trim();
                                    }
                                }
                            }
                            return "N/A";
                        });
                        const drive = await newPage
                            .$eval("[data-uname='DriverValue']", (el) =>
                                el.innerText.trim()
                            )
                            .catch(() => "N/A");
                        const fuel = await newPage
                            .$eval("[data-uname='lotdetailFuelvalue']", (el) =>
                                el.innerText.trim()
                            )
                            .catch(() => "N/A");
                        const engineType = await newPage
                            .$eval("[data-uname='lotdetailEnginetype']", (el) =>
                                el.innerText.trim()
                            )
                            .catch(() => "N/A");

                        await newPage.close();

                        details = {
                            lotNumber,
                            vin,
                            primaryDamage,
                            transmission,
                            color,
                            drive,
                            fuel,
                            engineType,
                        };

                        const carInfo = {
                            title,
                            make,
                            year,
                            model,
                            link,
                            currentBid,
                            details,
                            imageUrl,
                            thumbnails,
                            uuid: uuidv4(),
                            createdAt: formattedYesterday,
                        };

                        console.log(carInfo);
                        carData.push(carInfo);
                    } catch (error) {
                        console.log("Error processing car:", error);
                    }
                }

                const filename = path.join(
                    makeFolder,
                    `car_data_page_${pageNumber}.json`
                );
                fs.writeFileSync(filename, JSON.stringify(carData, null, 4));
                console.log(`✅ Page ${pageNumber} data saved.`);
                return carData;
            };

            // Scrape first page
            await scrapePage(1);

            for (
                let currentPage = 1;
                currentPage < lastPageNumber;
                currentPage++
            ) {
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
                    console.log("Error navigating to the next page:", error);
                    break;
                }
            }

            console.log(`✅ All data saved in folder '${makeFolder}'`);
        } catch (error) {
            console.error("Error scraping:", error);
        }
    }

    await browser.close();
})();
