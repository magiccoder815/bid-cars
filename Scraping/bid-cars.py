import json
import time
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager

# Set up Selenium options
options = Options()
# Headless mode is disabled
options.add_argument("--disable-gpu")
options.add_argument("--no-sandbox")
options.add_argument("--disable-dev-shm-usage")

# Initialize WebDriver
service = Service(ChromeDriverManager().install())
driver = webdriver.Chrome(service=service, options=options)

# URL to scrape
url = "https://bid.cars/en/search/results?search-type=filters&status=All&type=Automobile&make=Audi&model=All&year-from=2018&year-to=2026&auction-type=All"
driver.get(url)

time.sleep(5)  # Allow time for content to load

cars = []
while True:
    # Find car elements
    car_elements = driver.find_elements(By.CSS_SELECTOR, "div.item-horizontal.lots-search.red")
    
    for car in car_elements:
        name_element = car.find_element(By.CSS_SELECTOR, "div.name a.item-title")
        vin_element = car.find_element(By.CSS_SELECTOR, "span.vin_title")
        link = name_element.get_attribute("href")
        
        car_info = {
            "name": name_element.text,
            "vin": vin_element.text,
            "link": link
        }
        cars.append(car_info)
    
    # Check for "Load More" button
    try:
        load_more_button = driver.find_element(By.CSS_SELECTOR, "div.breadcrumbs.load-more a.btn.btn-primary")
        load_more_button.click()
        time.sleep(5)  # Allow time for new content to load
    except:
        break  # No more "Load More" button, exit loop

# Save to JSON
with open("cars.json", "w", encoding="utf-8") as f:
    json.dump(cars, f, ensure_ascii=False, indent=4)

# Print total count of scraped cars
print(f"Total cars scraped: {len(cars)}")

# Close WebDriver
driver.quit()

print("Scraping complete. Data saved to cars.json.")
