const mongoose = require('mongoose');

var Tickets = mongoose.Schema({
  ser: {
    type: String,
    required: true,
  },
  heading: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  personal: {
    type: String,
    required: true,
  },
  img: {
    type: String,
    required: true,
  },
  public_id: {
    type: String,
    required: true,
  },
  secret: {
    type: String,
    required: true,
  },
  donations: {
    type: [],
  }
});

var Tickets = mongoose.model('Tickets',Tickets);

module.exports = {Tickets};
