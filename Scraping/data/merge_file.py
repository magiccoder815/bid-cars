import pandas as pd
import glob
import json

# Step 1: Load all JSON files
json_files = glob.glob('*.json')  # Update the path as needed

# Step 2: Read and merge JSON files
dataframes = []
for json_file in json_files:
    with open(json_file, 'r') as file:
        data = json.load(file)
        df = pd.json_normalize(data)  # Normalize semi-structured JSON data into a flat table
        dataframes.append(df)

# Step 3: Combine all DataFrames
merged_df = pd.concat(dataframes, ignore_index=True)

# Step 4: Save to Excel
merged_df.to_excel('merged_data.xlsx', index=False, engine='openpyxl')