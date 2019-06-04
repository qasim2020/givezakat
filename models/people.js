const mongoose = require('mongoose');

var People = mongoose.model('people', {
  name: {
    type: String,
    required: true,
  },
  mob: {
    type: String,
    required: true,
    unique: true
  },
  salary: {
    type: String,
  },
  fMembers: {
    type: String,
  },
  story: {
    type: String,
    required: true,
  },
  address: {
    type: String,
    required: true,
  },
  sponsorName: {
    type: String,
    required: true,
  },
  sponsorMob: {
    type: String,
    required: true,
  },
  sponsorAccountTitle: {
    type: String,
    required: true,
  },
  sponsorAccountNo: {
    type: String,
    required: true,
  },
  sponsorAccountIBAN: {
    type: String,
    required: true,
  },
  package: {
    type: String,
    required: true,
  },
  packageCost: {
    type: String,
    required: true
  },
  packageQty: {
    type: String,
    required: true
  },
  orderDate: {
    type: String,
  },
  deliveryDate: {
    type: String,
  },
  pteInfo: {
    type: String,
  },
  nearestCSD: {
    type: String,
  },
  cardClass: {
    type: String,
    default: 'pending'
  },
  addedBy: {
    type: String,
    required: true,
  }
});

module.exports = {People};
