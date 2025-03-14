const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs");

puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    const url =
        "https://bid.cars/en/search/results?search-type=filters&status=All&type=Automobile&make=Audi&model=All&year-from=2020&year-to=2026&auction-type=All";
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    async function delay(time) {
        return new Promise((resolve) => setTimeout(resolve, time));
    }

    const totalSearchCount = await page.evaluate(() => {
        const countElement = document.querySelector(
            'a[data-value="All"] span.search-count'
        );
        return countElement
            ? parseInt(countElement.innerText.replace(/\D/g, ""), 10)
            : 0;
    });

    console.log(`Total search count: ${totalSearchCount}`);

    async function loadAllResults() {
        let currentCount = 0;

        while (currentCount < totalSearchCount) {
            try {
                const loadMoreBtn = await page.$(
                    "div.breadcrumbs.load-more a.btn-primary"
                );
                if (!loadMoreBtn) {
                    console.log('No more "Load More" button found.');
                    break;
                }
                await page.evaluate((el) => el.click(), loadMoreBtn);
                console.log("Clicked Load More...");

                await delay(5000);

                currentCount = await page.evaluate(
                    () =>
                        document.querySelectorAll(
                            "div.item-horizontal.lots-search a.item-title"
                        ).length
                );

                console.log(`Current loaded items: ${currentCount}`);
            } catch (error) {
                console.log("Error occurred:", error);
                break;
            }
        }
    }

    await loadAllResults();

    const carData = await page.evaluate(() => {
        const getTimestamp = (dateStr) => {
            const date = new Date(dateStr);
            return !isNaN(date.getTime())
                ? Math.floor(date.getTime() / 1000)
                : null;
        };

        return Array.from(
            document.querySelectorAll("div.item-horizontal.lots-search")
        ).map((item) => {
            const titleElement = item.querySelector("a.item-title");
            const title = titleElement
                ? titleElement.innerText.trim()
                : "Unknown Title";
            const link = titleElement ? titleElement.href : "#";

            const vinElement = item.querySelector("span.vin_title");
            const vin = vinElement
                ? vinElement.innerText.trim()
                : "Unknown VIN";

            const yearMatch = title.match(/\b(19|20)\d{2}\b/);
            const year = yearMatch ? parseInt(yearMatch[0], 10) : null;

            const titleParts = title.split(" ");
            const make =
                titleParts.length > 1
                    ? titleParts[1].toUpperCase()
                    : "Unknown Make";
            const model =
                titleParts.length > 2 ? titleParts[2] : "Unknown Model";

            const auctionStartElement = item.querySelector(".item-price .date");
            const auctionStartDateStr = auctionStartElement
                ? auctionStartElement.innerText.replace(/\n/g, " ").trim()
                : "";
            const auctionStartDate = getTimestamp(auctionStartDateStr);

            const auctionStatusElement = item.querySelector(
                ".item-price .spec-line"
            );
            let auctionStatus = auctionStatusElement
                ? auctionStatusElement.innerText.trim().toLowerCase()
                : "unknown";
            if (auctionStatus.includes("finished")) auctionStatus = "finished";
            else if (auctionStatus.includes("live")) auctionStatus = "live";
            else auctionStatus = "opened";

            const priceElement = item.querySelector(".item-price .price-box");
            const priceText = priceElement
                ? priceElement.innerText.replace(/[^0-9.]/g, "")
                : "0";
            const price = parseFloat(priceText) || 0;

            const auctionTypeElement = item.querySelector(".item-seller");
            const auctionType = auctionTypeElement
                ? auctionTypeElement.innerText.toLowerCase()
                : "unknown";

            const thumbnailElements = item.querySelectorAll(
                "div[data-thumb-src]"
            );
            const thumbnails = Array.from(thumbnailElements).map((el) =>
                el.getAttribute("data-thumb-src")
            );

            const mainImage = thumbnails ? thumbnails[0] : "";

            // Extracting specifications from data-original-title attributes
            const specsElement = item.querySelector(".item-specs");
            const specs = specsElement
                ? Array.from(specsElement.querySelectorAll(".specs span")).map(
                      (el) => el.getAttribute("data-original-title")
                  )
                : [];

            // Extracting damage info (ensure it only has "damage-info" class)
            const damageElement = item.querySelector(
                ".damage-info:not([class*=' '])"
            );
            let damage = damageElement
                ? damageElement.innerText.replace("Damage: ", "").trim()
                : "Unknown";

            // Clean up damage text (remove unwanted parts like newline and keep relevant part after ":")
            if (damage.includes("\n")) {
                damage = damage.split("\n")[1]; // Only keep the part after the newline
            }

            // Extracting specifications directly from data-original-title
            const transmission =
                specs.find(
                    (spec) =>
                        spec.toLowerCase().includes("automatic") ||
                        spec.toLowerCase().includes("manual")
                ) || "Unknown";

            const fuelType =
                specs.find(
                    (spec) =>
                        spec.toLowerCase().includes("hybrid") ||
                        spec.toLowerCase().includes("gasoline") ||
                        spec.toLowerCase().includes("diesel") ||
                        spec.toLowerCase().includes("electric")
                ) || "Other";

            const driveType =
                specs.find(
                    (spec) =>
                        spec.toLowerCase().includes("front") ||
                        spec.toLowerCase().includes("rear") ||
                        spec.toLowerCase().includes("all wheel")
                ) || "Unknown";

            // Extracting engine size, engine type, and horsepower from tooltip spans
            const engineInfoElements = item.querySelectorAll(
                'span[data-original-title="Engine size, type, horsepower"]'
            );
            const engineSize =
                engineInfoElements.length > 0
                    ? engineInfoElements[0].innerText.trim() || "Unknown"
                    : "Unknown";

            const engineType =
                engineInfoElements.length > 1
                    ? engineInfoElements[1].innerText.trim() || "Unknown"
                    : "Unknown";

            const horsepower =
                engineInfoElements.length > 2
                    ? engineInfoElements[2].innerText.trim() || "Unknown"
                    : "Unknown";

            return {
                title,
                make,
                year,
                model,
                link,
                vin,
                auctionType,
                auctionStartDate,
                auctionStatus,
                price,
                mainImage,
                thumbnails,
                specifications: {
                    damage,
                    transmission,
                    fuelType,
                    driveType,
                    engineSize,
                    engineType,
                    horsepower,
                },
            };
        });
    });

    // carData.forEach((car) => {
    //     console.log(`
    //         Title: ${car.title}
    //         Make: ${car.make}
    //         Year: ${car.year}
    //         Model: ${car.model}
    //         VIN: ${car.vin}
    //         Auction Type: ${car.auctionType}
    //         Auction Start Date: ${car.auctionStartDate}
    //         Auction Status: ${car.auctionStatus}
    //         Price: ${car.price}
    //         Link: ${car.link}
    //         Main Image URL: ${car.mainImage}
    //         Thumbnails: ${car.thumbnails}
    //         Damage: ${car.specifications.damage}
    //         Transmission: ${car.specifications.transmission}
    //         Fuel Type: ${car.specifications.fuelType}
    //         Drive Type: ${car.specifications.driveType}
    //         Engine Size: ${car.specifications.engineSize}
    //         Engine Type: ${car.specifications.engineType}
    //         Horsepower: ${car.specifications.horsepower}
    //     `);
    // });

    if (carData.length > 0) {
        fs.writeFileSync(
            "car_data_bidcars.json",
            JSON.stringify(carData, null, 2)
        );
        console.log("Data saved as car_data_bidcars.json");
    } else {
        console.log("No car data found!");
    }

    await browser.close();
})();
