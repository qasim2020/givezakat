var request = require("request");

var options = {
  method: 'POST',
  url: 'https://api.stripe.com/v1/tokens',
  headers:
   { 'Postman-Token': '01ad0446-6bed-46f5-b917-1c2b22a4bfb9',
     'cache-control': 'no-cache',
     'Authorization': `Bearer ${process.env.stripePrivate}` },
  form:
   { 'card[number]': '4242424242424242',
     'card[exp_month]': '12',
     'card[exp_year]': '2021',
     'card[cvc]': '123' }
   };

let getStripeToken = function() {
  return new Promise(function(resolve, reject) {
    request(options, function (error, response, body) {
      if (error) reject(error);
      resolve(body)
    });
  });
}



module.exports = {getStripeToken};
