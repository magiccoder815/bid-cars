import os
import json
import time
import re
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from selenium.common.exceptions import NoSuchElementException, ElementClickInterceptedException

# Set up Selenium options
options = Options()
options.add_argument("--disable-gpu")
options.add_argument("--no-sandbox")
options.add_argument("--disable-dev-shm-usage")

# Initialize WebDriver
service = Service(ChromeDriverManager().install())
driver = webdriver.Chrome(service=service, options=options)

url = "https://www.copart.com/lotSearchResults?free=true&query=&qId=9d03a1d2-1d10-4779-a6ab-497962109e20-1741568083803&emptySearch=true&index=undefined&searchCriteria=%7B%22query%22:%5B%22*%22%5D,%22filter%22:%7B%22MAKE%22:%5B%22lot_make_desc:%5C%22AUDI%5C%22%22%5D,%22YEAR%22:%5B%22lot_year:%5B2020%20TO%202025%5D%22%5D%7D,%22searchName%22:%22%22,%22watchListOnly%22:false,%22freeFormSearch%22:false%7D"

# Open the URL
driver.get(url)
time.sleep(10)

# Extract total search results
search_results_element = driver.find_element("css selector", "h3.text-black span.blue-heading")
total_results = int(search_results_element.text.replace(',', ''))
print(f"Total search results: {total_results}")

last_page_number = (total_results // 100) + (1 if total_results % 100 > 0 else 0)
print(f"Calculated last page number: {last_page_number}")

# Click the dropdown to open options
dropdown_trigger = driver.find_element("css selector", ".p-paginator-rpp-options")
dropdown_trigger.click()
time.sleep(2)

# Select "100" from the dropdown
option_100 = driver.find_element("css selector", "li[aria-label='100']")
option_100.click()
time.sleep(5)

def scrape_page(page_number):
    """Extracts car details from the current page and saves to a file."""
    cars = driver.find_elements("css selector", "tr.p-element.p-selectable-row.ng-star-inserted")
    print(f"Total cars found on page {page_number}: {len(cars)}")

    car_data = []

    for car in cars:
        try:
            # Extract Year, Make, Model
            title_element = car.find_element("css selector", "span.search_result_lot_detail")
            title = title_element.text.strip()
            title_parts = title.split(" ")

            year = title_parts[0]
            make = title_parts[1]
            model = title_parts[2]  # First word after Make

            # Extract link & image
            link_element = car.find_element("css selector", "a[aria-label='Lot Details']")
            car_link = f"https://www.copart.com{link_element.get_attribute('href')}"

            img_element = car.find_element("css selector", "a[aria-label='Lot Details'] img")
            main_image_url = img_element.get_attribute("src")

            # Extract lot number
            lot_number_element = car.find_element("css selector", ".search_result_lot_number")
            lot_number = lot_number_element.text.strip()

            # Extract Current Bid
            try:
                bid_container = car.find_element("css selector", "span.search_result_amount_block.text-black.p-bold")
                amount_element = bid_container.find_element("css selector", "span.currencyAmount")
                currency_element = bid_container.find_element("css selector", "span.currencyCode")

                amount_text = amount_element.text.strip()
                amount_value = re.sub(r'[^\d.]', '', amount_text)  # Extract only numeric value
                amount = float(amount_value) if amount_value else None
                currency = currency_element.text.strip()

                current_bid = {"Currency": currency, "Amount": amount}
            except NoSuchElementException:
                current_bid = None

            # Store data
            car_info = {
                "Title": title,
                "Make": make,
                "Year": year,
                "Model": model,
                "Link": car_link,
                "Main Image URL": main_image_url,
                "Lot Number": lot_number,
                "Current Bid": current_bid
            }
            print(car_info)
            car_data.append(car_info)

        except NoSuchElementException:
            print("Some elements were not found for this entry.")

    # Save the scraped data to a JSON file for this page
    filename = f'car_data_page_{page_number}.json'
    with open(filename, 'w') as f:
        json.dump(car_data, f, indent=4)
    print(f"Scraped data saved to '{filename}'")

# Scrape the first page
scrape_page(1)

# Iterate through all pages
current_page = 1
while current_page < last_page_number:
    try:
        next_button = driver.find_element("css selector", "button.p-paginator-next")
        if "p-disabled" in next_button.get_attribute("class"):
            print("Reached the last page.")
            break
        next_button.click()
        time.sleep(5)  # Wait for new page to load

        current_page += 1
        print(f"Scraping page {current_page}...")
        scrape_page(current_page)
    except (NoSuchElementException, ElementClickInterceptedException):
        print("Could not find or click the Next Page button.")
        break

# Close the browser
driver.quit()

### MERGE ALL JSON FILES ###
def merge_json_files():
    all_data = []
    page_number = 1

    while True:
        filename = f'car_data_page_{page_number}.json'
        if os.path.exists(filename):
            with open(filename, 'r') as f:
                data = json.load(f)
                all_data.extend(data)
            print(f"Merged data from {filename}")
            page_number += 1
        else:
            break  # Stop when no more files exist

    # Save the merged data into a single JSON file
    merged_filename = 'car_data_all.json'
    with open(merged_filename, 'w') as f:
        json.dump(all_data, f, indent=4)
    print(f"✅ All data merged into '{merged_filename}'")

# Run the merging function
merge_json_files()
