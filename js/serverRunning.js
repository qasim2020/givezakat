const {Users} = require('../models/users');
const {CountryInfo} = require('../models/countryinfo');
const {CurrencyRates} = require('../models/currencyrates');
const axios = require('axios');

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

  checkCurrencyExists().catch(e => console.log(e));
  // console.log('server running');
  CountryInfo.find().then(msg => {
    if (!msg.length) return getCountryInfo();
    // console.log('country Info is already saved !');
  });

  return setTimeout(() => serverRunning(),1000*3);

}

let getCountryInfo = function() {
  // console.log('get rates');
  axios.get(`https://restcountries.eu/rest/v2/all`).then((reply) => {
    // console.log('recieved list of countries');
    return CountryInfo.insertMany(reply.data);
  }).then((reply) => {
    console.log('Fetch CountryInfo from countrys api !');
  }).catch((e) => {
    console.log(e);
  });
}

let checkCurrencyExists = function() {

  return new Promise(function(resolve, reject) {

    let dt = new Date(), today = '';
    if (dt.getMonth + 1 < 10) {
      today = dt.getFullYear() + "-" + (dt.getMonth() + 1) + "-" + dt.getDate();
    } else {
      today = dt.getFullYear() + "-" + (dt.getMonth() + 1) + "-" + dt.getDate();
    };


    CurrencyRates.findOne({date: today}).lean().then((reply) => {
      if (!reply) resolve(updateCurrencyRate(today));
      resolve(reply);
    }).catch((e) => {
      reject(e);
    });

  });

}

let updateCurrencyRate = function(today) {
  return new Promise(function(resolve, reject) {
    axios.get(`http://data.fixer.io/api/latest?access_key=5fbf8634befbe136512317f6d897f822`).then((reply) => {
      let currency = new CurrencyRates({
        timestamp: reply.data.timestamp,
        base  : reply.data.base,
        date  : today,
        rates : JSON.stringify(reply.data.rates)
      });
      console.log('Fetching new exchange rates from Fixer API !');
      return currency.save();
    }).then((reply) => {
      resolve(reply);
    }).catch((e) => {
      reject(e);
    });
  });
};

module.exports = {serverRunning, checkCurrencyExists};
