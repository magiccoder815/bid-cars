const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

fs.readFile("Cars/cars.json", "utf8", (err, data) => {
    if (err) {
        console.error(err);
        return;
    }
    const cars = JSON.parse(data);
    const updatedCars = cars.map((car) => ({
        ...car,
        uuid: uuidv4(),
        createdAt: "2025-03-17", // Setting the createdAt to the specified date
    }));

    fs.writeFile("cars.json", JSON.stringify(updatedCars, null, 2), (err) => {
        if (err) {
            console.error(err);
        } else {
            console.log("Updated cars.json with uuid and createdAt");
        }
    });
});
