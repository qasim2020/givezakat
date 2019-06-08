const {Users} = require('../models/users');

var serverRunning = () => {
  Users.findOne({wrongAttempts:{$gte:5}}).then((user) => {
    if (!user) return false;
    var date = new Date();
    var diffInMillis = date - user.attemptedTime;
    if (diffInMillis > 1000 * 60 * 2) {
      return Users.findOneAndUpdate({"email":user.email},{$set:{wrongAttempts:0}},{new:true})
    }
    return Promise.resolve(`User found with wrong attempts: ${diffInMillis/1000} seconds ago`);
  }).then((response) => {
    if (!response) return;
    console.log(response);
  }).catch((e) => {
    console.log(e);
  });

  return setTimeout(() => serverRunning(),1000*5);

}

module.exports = {serverRunning};
