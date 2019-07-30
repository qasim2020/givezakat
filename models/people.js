const mongoose = require('mongoose');

var PeopleSchema = new mongoose.Schema({
  // Ser":"1","Name":"Zubaida Shauket","Mobile No":"03433044044","Earning per month":"8000","Occupation":"maid","Currency":"PKR","Family Members":"8","Address":
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
    // required: true,
  },
  sponsorMob: {
    type: String,
    // required: true,
  },
  sponsorAccountTitle: {
    type: String,
    // required: true,
  },
  sponsorAccountNo: {
    type: String,
    // required: true,
  },
  sponsorAccountIBAN: {
    type: String,
    // required: true,
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

// PeopleSchema.post('find', function(req,next) {
//   var user = this;
//   console.log(req.session);
//
//   next();
// });



var People = mongoose.model('People', PeopleSchema);

module.exports = {People};
