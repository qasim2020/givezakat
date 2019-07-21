const mongoose = require('mongoose');

var Orders = mongoose.model('orders', {
  paidby: {
    type: String,
    required: true,
    unique: false,
  },
  paidto: {
    type: String,
    required: true,
    unique: false
  },
  amount: {
    type: String,
    required: true,
  },
  currency: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    default: 'pending'
  },
  customer: {
    type: String,
    required: true,
  }
});

module.exports = {Orders};
