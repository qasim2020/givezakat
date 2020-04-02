const mongoose = require('mongoose');
// success: true,
//   timestamp: 1564485845,
//   base: 'EUR',
//   date: '2019-07-30',
//   rates: { PKR: 179.324997
var Covid = mongoose.model('covid', {
  page: {
    type: String,
    required: true,
  }
});

module.exports = {Covid};
