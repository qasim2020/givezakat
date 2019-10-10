const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

var CountryInfo = mongoose.Schema({
  name: {
    type: String,
  },
  topLevelDomain: {
    type: Array,
  },
  alpha2Code: {
    type: String,
  },
  alpha3Code: {
    type: String,
  },
  callingCodes: {
    type: Array,
  },
  capital: {
    type: String,
  },
  altSpellings: {
    type: Array,
  },
  region: {
    type: String,
  },
  subregion: {
    type: String,
  },
  population: {
    type: Number,
  },
  latlng: {
    type: Array,
  },
  demonym: {
    type: String,
  },
  area: {
    type: Number,
  },
  gini: {
    type: Number,
  },
  timezones: {
    type: Array,
  },
  borders: {
    type: Array,
  },
  nativeName: {
    type: String,
  },
  numericCode: {
    type: String,
  },
  currencies: {
    type: Array,
  },
  languages: {
    type: Array,
  },
  translations: {
    type: Array,
  },
  flag: {
    type: String,
  },
  regionalBlocs: {
    type: Array,
  },
  cioc: {
    type: String,
  },
});

var CountryInfo = mongoose.model('CountryInfo',CountryInfo);

module.exports = {CountryInfo};
