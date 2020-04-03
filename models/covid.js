const mongoose = require('mongoose');

var Covid = mongoose.model('covid', {
  root: {
    type: String,
    required: true,
  }
});

module.exports = {Covid};
