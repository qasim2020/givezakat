const {Users} = require('../models/users');
const {CountryInfo} = require('../models/countryinfo');
const {Covid} = require('../models/covid');
const {CurrencyRates} = require('../models/currencyrates');
const request = require('request');
const axios = require('axios');
const cheerio = require('cheerio');

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

  return setTimeout(() => serverRunning(),1000*5);

}

var hourlyRunning = () => {

  getNewCovid()
  .then(msg => console.log('downloaded fresh corona data'))
  .catch(e => console.log(e));

  return setTimeout(() => serverRunning(),1000*60*60*12);

}

let getNewCovid = function() {
  // return Covid.findOneAndUpdate({},{ $set: {"page": ['row']} },{upsert: true, new: true});
  return new Promise(function(resolve, reject) {
    console.log('starting page request');
    request('https://en.wikipedia.org/wiki/2020_coronavirus_pandemic_in_Pakistan', function(err, res, body) {
      if (err) return Promise.reject(err);
      const $ = cheerio.load(body, {
        xml: {
          normalizeWhitespace: true,
        }
      });
      let row = [];
      $('.wikitable.sortable > tbody').find('th,td').each(function(index) {
        row.push($(this).text().trim());
      });
      // console.log({msg: 'new download', row: row, length: row.length, type: typeof(row)});
      // console.log(`downloaded fresh data of corona >> length of row >> ${row.length}, typeOf row >> ${typeof(row)}`);
      Covid.findOneAndUpdate({},{ $set: {"page": row} },{upsert: true, new: true})
      .then(msg => resolve(msg))
      .catch(e => reject(e));
    })
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

module.exports = {serverRunning, checkCurrencyExists, hourlyRunning};
