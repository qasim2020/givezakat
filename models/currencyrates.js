const mongoose = require('mongoose');
// success: true,
//   timestamp: 1564485845,
//   base: 'EUR',
//   date: '2019-07-30',
//   rates: { PKR: 179.324997
var CurrencyRates = mongoose.model('currencyRates', {
  timestamp: {
    type: Number,
    required: true,
  },
  base: {
    type: String,
    required: true,
  },
  date: {
    type: String,
    required: true,
  },
  rates: {
    type: String,
    required: true,
  }
});

module.exports = {CurrencyRates};
