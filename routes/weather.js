var express = require('express');
var router = express.Router();

const fetch = require('node-fetch');
const City = require('../models/cities');
const User = require('../models/users');

const OWM_API_KEY = process.env.OWM_API_KEY;


// Update weather data for a specific city in user's list
const updateCityWeatherForUser = async (cityName, country) => {
	const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${cityName}&appid=${OWM_API_KEY}&units=metric`);
	const apiData = await response.json();

	if (apiData.cod === 200) {
		// Find the city in the user's list
		const updateResult = await User.findOneAndUpdate(
			{ cities: { $elemMatch: { cityName: cityName, country: country } } },
			{
				$set: {
					"cities.$.main": apiData.weather[0].main,
					"cities.$.country": apiData.sys.country,
					"cities.$.description": apiData.weather[0].description,
					"cities.$.icon": apiData.weather[0].icon,
					"cities.$.temp": apiData.main.temp,
					"cities.$.feels_like": apiData.main.feels_like,
					"cities.$.tempMin": apiData.main.temp_min,
					"cities.$.tempMax": apiData.main.temp_max,
					"cities.$.humidity": apiData.main.humidity,
					"cities.$.wind": apiData.wind.speed,
					"cities.$.clouds": apiData.clouds.all,
					"cities.$.rain": apiData.rain ? apiData.rain['1h'] : 0,
					"cities.$.snow": apiData.snow ? apiData.snow['1h'] : 0,
					"cities.$.sunrise": apiData.sys.sunrise,
					"cities.$.sunset": apiData.sys.sunset,
					"cities.$.latitude": apiData.coord.lat,
					"cities.$.longitude": apiData.coord.lon,
					"cities.$.timezone": apiData.timezone,
				}
			},
			{ new: true } // Return the updated document
		);
		if (!updateResult) {
			console.log(`No matching document found for cityName: ${cityName}, country: ${country}`);
		} else {
			console.log('Update Result:', updateResult); // Log update result for debugging
		}
	}
};

// Update weather data for cities in user's list
router.get('/updateUserCities', async (req, res) => {
	try {
		const user = await User.findOne({ token: req.query.token });

		if (!user) {
			console.log('User not found for token:', req.query.token);
			return res.json({ result: false, error: 'User not found' });
		}

		const updatePromises = user.cities.map(city => updateCityWeatherForUser(city.cityName, city.country));
		await Promise.all(updatePromises);

		console.log('All cities updated successfully');

		await user.save();

		res.json({ result: true, message: 'All cities updated successfully' });
	} catch (error) {
		console.error(error);
		res.status(500).json({ result: false, error: 'Internal Server Error' });
	}
});

// Get user's cities
router.get('/userCities', async (req, res) => {
	try {
		const user = await User.findOne({ token: req.query.token });
		if (!user) {
			return res.json({ result: false, error: 'User not found' });
		}

		res.json({ result: true, cities: user.cities });
	} catch (error) {
		console.error(error);
		res.status(500).json({ result: false, error: 'Internal Server Error' });
	}
});

// Get all cities for local storage
router.get('/localStorageCities', async (req, res) => {
	const cityName = req.query.cityName;
	const country = req.query.country;
	const lat = req.query.lat;
	const lon = req.query.lon;

	try {
		let response, data;

		if (cityName && country) {
			response = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${cityName},${country}&appid=${OWM_API_KEY}&units=metric`);
		} else if (lat && lon) {
			response = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OWM_API_KEY}&units=metric`);
		} else {
			return res.json({ result: false, error: 'Missing cityName or lat/lon in request query' });
		}

		data = await response.json();
		if (data.cod === 200) {

			const weather = {
				cityName: data.name,
				country: data.sys.country,
				main: data.weather[0].main,
				description: data.weather[0].description,
				icon: data.weather[0].icon,
				temp: data.main.temp,
				feels_like: data.main.feels_like,
				tempMin: data.main.temp_min,
				tempMax: data.main.temp_max,
				humidity: data.main.humidity,
				wind: data.wind.speed,
				clouds: data.clouds.all,
				sunrise: data.sys.sunrise,
				sunset: data.sys.sunset,
				latitude: data.coord.lat,
				longitude: data.coord.lon,
				timezone: data.timezone,
			};

			res.json({ result: true, weather });
		} else {
			res.json({ result: false, error: data.message });
		}
	} catch (error) {
		res.json({ result: false, error: 'An error occurred while fetching the weather data' });
	}
});


// Add city to user's list in the database
router.post('/addCity', async (req, res) => {
	try {
		// Authenticate user by token
		const user = await User.findOne({ token: req.body.token });
		if (!user) {
			return res.json({ result: false, error: 'User not found' });
		}

		let apiData;

		// Fetch weather data based on cityName an country or lat/lon
		if (req.body.cityName && req.body.country) {
			const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${req.body.cityName},${req.body.country}&appid=${OWM_API_KEY}&units=metric`);
			apiData = await response.json();
		} else if (req.body.lat && req.body.lon) {
			const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${req.body.lat}&lon=${req.body.lon}&appid=${OWM_API_KEY}&units=metric`);
			apiData = await response.json();
		} else {
			return res.json({ result: false, error: 'Missing cityName or lat/lon in request body' });
		}

		// Check if city already exists in the database
		const existingCity = user.cities.find(city => city.cityName.toLowerCase() === apiData.name.toLowerCase()
			&& city.country.toLowerCase() === apiData.sys.country.toLowerCase());

		if (existingCity) {
			return res.json({ result: false, error: 'City already exists in the database' });
		}

		// Create a new city object
		const newCity = {
			cityName: apiData.name,
			country: apiData.sys.country,
			main: apiData.weather[0].main,
			description: apiData.weather[0].description,
			icon: apiData.weather[0].icon,
			temp: apiData.main.temp,
			feels_like: apiData.main.feels_like,
			tempMin: apiData.main.temp_min,
			tempMax: apiData.main.temp_max,
			humidity: apiData.main.humidity,
			wind: apiData.wind.speed,
			clouds: apiData.clouds.all,
			rain: apiData.rain ? apiData.rain['1h'] : 0,
			snow: apiData.snow ? apiData.snow['1h'] : 0,
			sunrise: apiData.sys.sunrise,
			sunset: apiData.sys.sunset,
			latitude: apiData.coord.lat,
			longitude: apiData.coord.lon,
			timezone: apiData.timezone,
		};

		// Add the new city to user's cities
		user.cities.push(newCity);
		await user.save();

		// Return success response with the user's cities
		res.json({ result: true, cities: user.cities });
	} catch (error) {
		console.error('Error:', error.message);
		res.status(500).json({ result: false, error: 'Internal Server Error' });
	}
});

// get city forecast
router.get('/forecast/:cityName', async (req, res) => {
	const response = await fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${req.params.cityName}&appid=${OWM_API_KEY}&units=metric`);
	const apiData = await response.json();
	if (apiData.cod !== '200') {
		res.json({ result: false, error: apiData.message });
		return;
	} else {
		res.json({ result: true, weather: apiData });
	}
});

// Get city by name
router.get("/:cityName", (req, res) => {
	City.findOne({
		cityName: { $regex: new RegExp(req.params.cityName, "i") },
	}).then(data => {
		if (data) {
			res.json({ result: true, weather: data });
		} else {
			res.json({ result: false, error: "City not found" });
		}
	});
});

// Delete city by name
router.delete("/:cityName", (req, res) => {
	City.deleteOne({
		cityName: { $regex: new RegExp(req.params.cityName, "i") },
	}).then(deletedDoc => {
		if (deletedDoc.deletedCount > 0) {
			// document successfully deleted
			City.find().then(data => {
				res.json({ result: true, weather: data });
			});
		} else {
			res.json({ result: false, error: "City not found" });
		}
	});
});


module.exports = router;
