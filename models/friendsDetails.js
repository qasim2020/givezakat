const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

var FriendsDetailsSchema = mongoose.Schema({
  refId: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true,
  },
  emailId: {
    type: String,
    required: true,
  },
  withMeAt: {
    type: String,
    required: true
  },
  memorableOccasionWithMe: {
    type: String,
  },
  currentAddress: {
    type: String,
    required: true
  }
});

FriendsDetailsSchema.pre('save', function(next) {
  var user = this;

  if (user.isModified('password')) {
    bcrypt.genSalt(10, (err, salt) => {
      bcrypt.hash(user.password, salt, (err, hash) => {
        user.password = hash;
        next();
      });
    });
  } else {
    next();
  }
})

var FriendsDetails = mongoose.model('FriendsDetails',FriendsDetailsSchema);

module.exports = {FriendsDetails};
