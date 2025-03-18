const fs = require("fs");
const path = require("path");

const carsDir = "Cars";

// Function to read and merge JSON files
const mergeJsonFiles = (folderPath) => {
    const jsonFiles = fs
        .readdirSync(folderPath)
        .filter((file) => file.endsWith(".json"));
    let mergedData = [];

    jsonFiles.forEach((file) => {
        const filePath = path.join(folderPath, file);
        try {
            const fileData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
            if (Array.isArray(fileData)) {
                mergedData = mergedData.concat(fileData);
            } else {
                mergedData.push(fileData);
            }
        } catch (error) {
            console.error(`Error reading ${filePath}:`, error);
        }
    });

    return mergedData;
};

// Step 1: Merge JSON files within each folder
const mergedFiles = [];

fs.readdirSync(carsDir).forEach((folder) => {
    const folderPath = path.join(carsDir, folder);
    if (fs.lstatSync(folderPath).isDirectory()) {
        const mergedData = mergeJsonFiles(folderPath);
        const outputFile = path.join(folderPath, `${folder}.json`);

        fs.writeFileSync(outputFile, JSON.stringify(mergedData, null, 4));
        mergedFiles.push(outputFile);
    }
});

// Step 2: Merge all {folder_name}.json files into cars.json
let carsData = [];

mergedFiles.forEach((filePath) => {
    try {
        const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        if (Array.isArray(data)) {
            carsData = carsData.concat(data);
        } else {
            carsData.push(data);
        }
    } catch (error) {
        console.error(`Error reading ${filePath}:`, error);
    }
});

// Save the final merged JSON in the Cars directory
const finalOutput = path.join(carsDir, "cars.json");
fs.writeFileSync(finalOutput, JSON.stringify(carsData, null, 4));

console.log("Merging completed successfully!");
