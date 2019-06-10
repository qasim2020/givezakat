const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

var Subscription = mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true
  }
});

var Subscription = mongoose.model('Subscription',Subscription);

module.exports = {Subscription};
