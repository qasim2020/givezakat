const {Users} = require('../models/users');
const {CountryInfo} = require('../models/countryinfo');
const {Covid} = require('../models/covid');
const {CurrencyRates} = require('../models/currencyrates');
const request = require('request');
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

  CountryInfo.find().then(msg => {
    if (!msg.length) return getCountryInfo();
  });

  // Covid.deleteMany({}).then(msg => console.log(msg));

  // TODO: findOneAndUpdate

  // Covid.find()
  // .then(msg => {
  // //   // if (!msg.length) return getNewCovid();
  // //   // console.log((new Date() - msg[0]._id.getTimestamp())/1000/60/60/12 > 1 || msg.length < 1);
  //   console.log(msg.length);
  //   if (msg.length < 1) return getNewCovid();
  //   if ((new Date() - msg[0]._id.getTimestamp())/1000/60/60/12 > 1) return getNewCovid();
  //   return Promise.reject(`Covid data exists >> Length: ${msg.length}`);
  // })
  // .then(msg => console.log(msg))
  // .catch(e => console.log(e));

  return setTimeout(() => serverRunning(),1000*5);

}

let getNewCovid = function() {
  request('https://en.wikipedia.org/wiki/2020_coronavirus_pandemic_in_Pakistan', function(err, res, body) {
    if (err) return Promise.reject(err);
    let covid = new Covid({root: body});
    return covid.save();
  });
};

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
  return today;
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

function addDays(date, days) {
  var result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function subtractDays(date, days) {
  var result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

module.exports = {serverRunning, checkCurrencyExists};
