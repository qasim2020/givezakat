const mongoose = require('mongoose');

var Covid = mongoose.model('covids', {
  page: {
    type: [],
    required: true
  }
});

module.exports = {Covid};
