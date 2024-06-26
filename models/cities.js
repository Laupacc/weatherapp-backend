const mongoose = require('mongoose');

const citySchema = mongoose.Schema({
	cityName: String,
	country: String,
	main: String,
	description: String,
	icon: String,
	temp: Number,
	feels_like: Number,
	tempMin: Number,
	tempMax: Number,
	humidity: Number,
	wind: Number,
	clouds: Number,
	rain: Number,
	snow: Number,
	sunrise: Number,
	sunset: Number,
	latitude: Number,
	longitude: Number,
	timezone: Number,
});

const City = mongoose.model('cities', citySchema);

module.exports = City;

