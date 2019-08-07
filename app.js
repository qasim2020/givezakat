require('./config/config');

const http = require('http');
const express = require('express');
const pjax    = require('express-pjax');
const bodyParser = require('body-parser');
const hbs = require('hbs');
var cookieParser = require('cookie-parser')
const _ = require('lodash');
const readXlsxFile = require('read-excel-file/node');
const axios = require('axios');
const {OAuth2Client} = require('google-auth-library');
const session = require('express-session');

const stripe = require('stripe')(process.env.stripePrivate);

const {sheet} = require('./server/sheets.js');
const {mongoose} = require('./db/mongoose');
const {People} = require('./models/people');
const {Orders} = require('./models/orders');
const {CurrencyRates} = require('./models/currencyrates');
const {Users} = require('./models/users');
const {sendmail} = require('./js/sendmail');
const {serverRunning} = require('./js/serverRunning');
const {Subscription} = require('./models/subscription');


var app = express();
var port = process.env.PORT || 3000;
app.use(pjax());
app.use(express.static(__dirname+'/static'));
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
app.use(cookieParser());
app.use(session({
  secret: process.env.sessionSecret,
  resave: false,
  saveUninitialized: true,
  cookie: {maxAge:6000}
}))
app.set('view engine','hbs');
hbs.registerPartials(__dirname + '/views/partials');
hbs.registerHelper("inc", function(value, options) {
    return parseInt(value) + 1;
});
app.use(function(req, res, next) {
  // if now() is after `req.session.cookie.expires`
  // console.log(req.session.cookie.expires);
  //   regenerate the session
  next();
});

let authenticate = (req,res,next) => {
  let token = req.params.token || req.body.token || req.query.token;
  console.log('token receiveed',token);
  Users.findByToken(token).then((user) => {
    if (!user) return Promise.reject('No user found');
    req.params.user = user;
    next();
  }).catch((e) => {
    console.log(e);
    req.url = '/';
    return app._router.handle(req, res, next);
  });
};


app.get('/hacks',(req,res) => {
  res.render('1-fp.hbs');
});

app.get('/profile/:token',authenticate,(req,res) => {
  // get all data updated by me

  if (!req.session.token) {
      return res.render('1-redirect.hbs',{
      timer: 3,
      page: 'No Session Found !',
      message: 'You are not logged in, redirecting you to home page',
    });
  };

  People.find({addedBy: req.params.user._id}).then((sponsored) => {
    // get all orders placed by me
    req.sponsored = getEachSalaryText(sponsored,req);
    _.each(sponsored,(val,key) => {
      val.unlocked = true;
    })
    req.sponsored = sponsored;
    return Orders.find({paidby: req.params.user._id});
  }).then((orders) => {
    req.orders = orders;
    let ids = [];
    _.each(orders,(val,key) => {
      ids.push(mongoose.Types.ObjectId(val.paidto));
    });
    return People.find({_id:{ $in: ids}});
  }).then((payed) => {
    // get all suggestions raised by me - FEATURE PENDING
    let stuff = {};
    _.each(payed,(val,key) => {
      stuff = req.orders.filter(obj => {
        return val._id == obj.paidto;
      })[0];
      val.amount = stuff.amount + ' ' + stuff.currency;
      val.status = stuff.status;
      val.receipt = stuff.receipt;
    });

    res.status(200).render('1-profile.hbs',{
      token: req.params.token,
      name: req.params.user.name,
      email: req.params.user.email,
      phone: req.params.user.phone,
      profile: 'active',
      data: req.sponsored,
      dueIds: req.session.due,
      payed: payed,
    });
  }).catch((e) => {
    console.log(e);
    res.render('1-redirect.hbs',{
      timer: 6,
      page: 'No Session Found !',
      message: e,
      token: req.session.token,
    });
  });
});

let getCount = function () {
  return People.aggregate([
    { "$facet": {
      "Total": [
        { "$match" : { "cardClass": {'$exists' : true}}},
        { "$count": "Total" },
      ],
      "pending": [
        { "$match" : { "cardClass": 'pending'}},
        { "$count": "pending" },
      ],
      "delivered": [
        { "$match" : { "cardClass": 'delivered'}},
        { "$count": "delivered" },
      ],
      "inprogress": [
        { "$match" : { "cardClass": 'inprogress'}},
        { "$count": "inprogress" },
      ],
    }},
    { "$project": {
      "Total": { "$arrayElemAt": ["$Total.Total", 0] },
      "pending": { "$arrayElemAt": ["$pending.pending", 0] },
      "delivered": { "$arrayElemAt": ["$delivered.delivered", 0] },
      "inprogress": { "$arrayElemAt": ["$inprogress.inprogress", 0] },
    }}
  ]);
};

app.get('/',(req,res) => {

  if (!req.session.due) req.session.due = [];

  getCount().then((msg) => {
    req.count = msg;
    return readXlsxFile(__dirname+'/static/sample.xlsx');
  }).then((rows) => {
    req.session.sampleRows = rows[0];
    let options = {
      sampleRows: rows[0],
      due: req.session.due && req.session.due.length,
      dueIds: req.session.due,
      currency: req.session.hasOwnProperty('browserCurrency'),
      count: req.count[0],
    };
    if (req.headers.accept == 'test_call') return res.status(200).send(options);
    res.status(200).render('1-home.hbs', options);
  }).catch((e) => {
    console.log(e);
    res.status(404).send(e);
  });
});

app.get('/loadmore',(req,res) => {
  console.log('load more people');
  People.find().skip(Number(req.query.skip)).limit(12).then((result) => {
    res.status(200).send(result);
  }).catch((e) => {
    console.log(e);
    res.status(400).send(e);
  });
});


app.get('/zakatcalc',(req,res) => {

  res.render('1-zakatcalc.hbs',{
    zakatcalc: 'active',
    token: req.session.token,
    name: req.session.name,
    due: req.session.due && req.session.due.length,
  });

});

app.get('/signin/:call',(req,res) => {
  console.log(req.params.call);
  let options = {};
  if (req.params.call != 'home') {
    options = {
      signin: 'active',
      call: `${req.params.call}`,
      due: req.session.due && req.session.due.length,
    };
  } else {
    options = {signin: 'active'};
  };
  res.render('1-signin.hbs', options);
})

app.get('/signup',(req,res) => {
  res.render('1-signup.hbs',{
    signin: 'active'
  });
})

app.get('/forgotpw',(req,res) => {
  res.render('1-fp.hbs',{
    signin: 'active',
    due: req.session.due && req.session.due.length,
  });
});

app.get('/addpeople/:token',authenticate,(req,res) => {

  readXlsxFile(__dirname+'/static/sample.xlsx').then((rows) => {
    res.render('1-addpeople.hbs',{
      addpeople: 'active',
      sampleRows: rows[0],
      token: req.session.token,
      name: req.session.name,
      due: req.session.due && req.session.due.length,
    });
  }).catch((e) => {
    console.log(e);
    res.render('1-404');
  })

});

app.get('/updateperson/:call',(req,res) => {

  if (!(req.session.token)) return res.render('1-signin.hbs',{
    signin: 'active',
    message: 'You need to sign in to add people.',
    call: 'addpeople',
  });

  res.render('1-updateperson.hbs',{
    // due: 'active',
    // url: result.data.response.url,
    addpeople: 'active',
    token: req.session.token,
    name: req.session.name,
    call: req.params.call.split('+').join(' '),
  });
});

app.get('/due/:token',authenticate,(req,res) => {

  console.log('****Due Page*****');

  if (!req.session.due) {
    return res.render('1-redirect.hbs',{
      timer: 6,
      page: 'No Session Found !',
      message: 'Sorry you have not logged in yet.',
      token: req.session.token
    })
  };

  if (req.session.due && req.session.due.length < 1) {
    return res.render('1-redirect.hbs',{
      timer: 3,
      page: 'No People Selected !',
      message: 'Sorry you have not selected any body yet. Redirecting you to home page.',
      token: req.session.token
    })
  };

  let objectIdArray = req.session.due.map(s => mongoose.Types.ObjectId(s));

  return People.find({'_id' : {$in : objectIdArray}}).then((msg) => {
      msg = getEachSalaryText(msg,req);
      res.render('1-due.hbs',{
        people: msg,
        dueStatus: 'active',
        due: req.session.due && req.session.due.length,
        token: req.session.token,
        name: req.session.name,
        email: req.params.user.email,
        localCurrency: req.currency
      });
    }).catch((error) => {
      console.log(error);
      res.render('1-redirect.hbs',{
        message: error,
        token: req.params.token,
        page: 'Due People',
      })
    });

});

function updateOrders(req,res) {

  return new Promise(function(resolve, reject) {
    let paymentDetails = JSON.parse(req.query.paymentDetails);
    let objectIdArray = paymentDetails.map(s => s.mob);
    People.find({'mob' : {$in : objectIdArray}}).then((msg) => {
      req.people = msg;
      return Users.findByToken(req.query.token);
    }).then((user) => {
      if (!user) return Promise.reject('un authorized request');
      let array = [];
      let values = {};
      _.each(req.people,(val,key) => {
        values = {};
        values.paidby = user._id.toString();
        values.paidto = val._id.toString();
        values.amount = paymentDetails.filter(obj => {
                            return obj.mob === val.mob;
                        })[0].amount;
        values.status = 'pending';
        values.currency = req.session.browserCurrency.currency_code.toLowerCase();
        values.customer = req.charge.customer;
        values.receipt = req.charge.receipt_url;
        array.push(values);

        val.status = 'pending';
        val.amount = `${values.amount} ${values.currency}`;
      });
      return Orders.create(array,{new:true});
    }).then((order) => {
      return resolve(order);
    }).catch((e) => {
      return reject(e);
    });
  });

}

app.get("/charge", authenticate, (req, res) => {

  console.log('***making Charge***');
  stripe.products.create({
	      name: 'T-shirt',
	      type: 'good',
        description: 'Comfortable cotton t-shirt',
        attributes: ['size', 'gender']
  }).then((msg) => {
    return stripe.customers.create({
      email: req.query.email,
      card: req.query.stripeToken
    });
  }).then((customer) => {
     return stripe.charges.create({
      amount: req.query.amount,
      description: "Zakat",
      currency: req.session.browserCurrency.currency_code.toLowerCase(),
      customer: customer.id
    });
  }).then((charge) => {
    req.charge = charge;
    return updateOrders(req,res);
  }).then((msg) => {
    req.session.due = [];
    res.render('1-charge.hbs',{
      dueStatus: 'active',
      due: req.session.due && req.session.due.length,
      token: req.session.token,
      name: req.session.name,
      receipt: req.charge.receipt_url,
      payed: req.people
    });
  }).catch(err => {
    console.log(err);
    res.render('1-redirect.hbs',{
      timer: 6,
      page: 'Payment Failed !',
      message: err.message,
      token: req.session.token,
    });
  });
});

app.post('/data',(req,res) => {

  if (req.body) {
    return res.status(200).send('data recieved');
  }
  res.status(400).send('sorry no data recieved');

});

app.post('/excelData',(req,res) => {
  var body = [];
  _.each(req.body,(val,key)=> {
    val.addedBy = req.session.myid;
    val.cardClass = 'pending';
    body[key] = _.pick(val,['name','mob','salary','fMembers','story','address','sponsorName','sponsorMob','sponsorAccountTitle','sponsorAccountNo','sponsorAccountIBAN','package','packageCost','packageQty','orderDate','deliveryDate','pteInfo','nearestCSD','cardClass','addedBy']);
  });

  var bulk = People.collection.initializeUnorderedBulkOp();
  _.each(req.body, (val,key) => {
    bulk.find( { mob: val.mob } ).upsert().update( { $set: val } )
  })

  bulk.execute().then((msg) => {
    res.status(200).send(msg.result);
  }).catch((e) => {
    let errors = [];
    if (e.result.result) {
      errors.push(`Updated <b>${e.result.result.nInserted}</b> rows!`);
      errors.push(`Failed to update <b>${e.result.result.writeErrors.length}</b> rows due to duplicates:-`)
      _.each(e.result.result.writeErrors,(val,key) => {
        errors.push(key + '. ' + val.err.op.name + ', ' + val.err.op.mob);
      })
      console.log(errors);
      return res.status(400).send(errors);
    }
    res.status(400).send(e);

  });

});

app.get('/home/:token', authenticate, (req,res) => {

  if (!req.session.due) req.session.due = [];

  console.log(`**** `,req.params.user.name,'entered home *****');

  // LIST ALL PEOPLE
  getCount().then((msg) => {
    req.count = msg;
    return People.find().limit(12);
  }).then((msg) => {
    req.data = msg;
    return Orders.find({paidby: req.params.user._id});
  }).then((msg) => {
    let ids = [];
    _.each(msg,(val,key) => {
      ids.push(val.paidto);
    });
    return People.find({_id: {$in : ids}});
  }).then((msg) => {
    // EXCEL SHEET PATTERN
    req.paidpeople = msg;
    return readXlsxFile(__dirname+'/static/sample.xlsx')
  }).then((rows) => {
    // Add PAIDBYME and ADDEDBYME on People's list retrieved
    let values = {};
    _.each(req.data,(val,key) => {
      val.paidbyme = req.paidpeople.filter(paidpeople => {
        return paidpeople._id == val._id;
      }).name;
      if (val.addedBy == req.params.user._id) {
        val.addedbyme = true;
      } else {
        val.addedbyme = false;
      };
      if (val.addedbyme || val.paidbyme && val.paidbyme.length > 0) val.unlocked = true;
    });
    res.render('1-home.hbs',{
      token: req.session.token,
      name: req.params.user.name,
      due: req.session.due && req.session.due.length,
      dueIds: req.session.due,
      currency: req.session.hasOwnProperty('browserCurrency'),
      count: req.count[0]
    });
  }).catch((e) => {
    console.log(e);
    res.status(404).send(e);
  });

});

app.get('/logout/:token', authenticate, (req,res) => {
  console.log(req.params.user.name,'logged out');
  let user = req.params.user;
  user.removeToken(req.params.token).then((user) => {
    req.session.destroy(function(err) {
      req.url = '/';
      return app._router.handle(req, res);
    });
  }).catch((e) => {
    console.log(e);
    res.status(404).send(e);
  });
});

let getEachSalaryText = function(msg,req) {
  let browserCurrencyRate = 0, thisPersonsCurrencyRate = 0 , mySalaryInBrowsersCurrency = 0;
  _.each(msg,(val,key) => {
    browserCurrencyRate = JSON.parse(req.session.currencyRates && req.session.currencyRates.rates)[req.session.browserCurrency && req.session.browserCurrency.currency_code];
    if (!browserCurrencyRate || browserCurrencyRate == '') {
      browserCurrencyRate = JSON.parse(req.session.browserCurrency && req.session.currencyRates.rates)['USD'];
      thisPersonsCurrencyRate = JSON.parse(req.session.currencyRates && req.session.currencyRates.rates)[val.currency];
      mySalaryInBrowsersCurrency = Math.floor(browserCurrencyRate / thisPersonsCurrencyRate * val.salary);
      return val.salary = `${mySalaryInBrowsersCurrency} USD per Month`;
    }
    thisPersonsCurrencyRate = JSON.parse(req.session.currencyRates && req.session.currencyRates.rates)[val.currency];
    mySalaryInBrowsersCurrency = Math.floor(browserCurrencyRate / thisPersonsCurrencyRate * val.salary);
    val.salary = `${mySalaryInBrowsersCurrency} ${req.session.browserCurrency && req.session.browserCurrency.currency_code} per Month`;
  });
  return msg;
}

app.get('/peopleBussinessCards',(req,res) => {

  let regex = new RegExp(req.query.expression,'gi');

  if (req.query.type == 'all') {

    return People.find({cardClass: regex}).limit(parseInt(req.query.showQty)).then((msg) => {
      if (!msg || msg.length < 1) return Promise.reject({code: 404,msg: 'Did not find any people for this filter !'});
      req.data = msg;
      msg = getEachSalaryText(msg,req);
      if (req.query.token.length <  30) return Promise.reject({code: 404,msg: 'No user found, showing all data as locked !'});
      return Users.findByToken(req.query.token);
    }).then((user) => {
      // IF USER IS LOGGED IN > UNLOCK HIS LIST (ADDED BY HIM + PAID BY HIM)
      if (!user) return Promise.reject('No user logged in found.');
      req.loggedIn = user;
      return Orders.find({paidby: req.loggedIn._id});
    }).then((msg) => {
      let ids = [];
      _.each(msg,(val,key) => {
        ids.push(val.paidto);
      });
      return People.find({_id: {$in : ids}});
    }).then((msg) => {
      // EXCEL SHEET PATTERN
      req.paidpeople = msg;
      return readXlsxFile(__dirname+'/static/sample.xlsx')
    }).then((rows) => {
      // Add PAIDBYME and ADDEDBYME on People's list retrieved
      let values = {};
      _.each(req.data,(val,key) => {

        val.paidbyme = req.paidpeople.filter(paidpeople => {
          return paidpeople._id == val._id;
        }).name;

        if (val.addedBy == req.loggedIn._id) {
          val.addedbyme = true;
        } else {
          val.addedbyme = false;
        };

        if (val.addedbyme || val.paidbyme && val.paidbyme.length > 0) val.unlocked = true;

      });
      return res.renderPjax('2-peopleBussinessCards.hbs',{
        data: req.data,
        query: req.query
      });
    }).catch((e) => {
      console.log(e)
      if (e.code == 404) return res.renderPjax('2-peopleBussinessCards.hbs',{
        data: req.data,
        query: req.query,
        message: e.msg
      });
      return res.renderPjax('2-error.hbs');
    });

  };

  if (req.query.type == 'my') {

    if (!req.query.token) return res.renderPjax('2-error.hbs',{msg: 'You are not logged in. Please log in to view people you have sponsored and your orders !'});

    return Users.findByToken(req.query.token).then((user) => {
      if (!user) Promise.reject({code: '404',msg: 'Please log in to make this request !'});
      req.loggedIn = user;
      return People.find({addedBy: user._id, cardClass: regex}).limit(parseInt(req.query.showQty));
    }).then((peopleAddedByMe) => {
      if (!peopleAddedByMe) Promise.reject({msg: 'You have not sponsored any user yet !'});
      req.addedbyme = getEachSalaryText(peopleAddedByMe,req);
      _.each(peopleAddedByMe,(val,key) => {
        val.addedbyme = true;
        val.unlocked = true;
      });
      return Orders.find({paidby: req.loggedIn._id}).limit(4);
    }).then((orders) => {
      req.orders = orders;
      let ids = [];
      _.each(orders,(val,key) => {
        ids.push(orders.paidto);
      });
      return People.find({_id: {$in: ids}, cardClass: regex});
    }).then((peopleOrderedByMe) => {
      // req.paidbyme = peopleOrderedByMe;
      console.log(peopleOrderedByMe.length, '<< People ordered by  me');
      _.each(peopleOrderedByMe,(val,key) => {
        val.paidbyme = true;
        val.unlocked = true;
      });
      req.paidbyme = getEachSalaryText(peopleOrderedByMe,req);
      return res.renderPjax('2-peopleMyList.hbs',{
        paidbyme: req.paidbyme,
        addedbyme: req.addedbyme,
        query: req.query,
      });
    }).catch((e) => {
      console.log(e);
      if (e.code == 404) return res.renderPjax('2-peopleMyList.hbs',{ data: req.data, query:req.query });
      return res.renderPjax('2-error.hbs',{ msg: e.msg });
    })
  }

});

let createCurrencySession = function(req,input) {
  return new Promise(function(resolve, reject) {

      req.session.browserCurrency = {currency_code: input.currency_code};

      let dt = new Date(), today = '';
      if (dt.getMonth + 1 < 10) {
        today = dt.getFullYear() + "-" + (dt.getMonth() + 1) + "-" + dt.getDate();
      } else {
        today = dt.getFullYear() + "-" + (dt.getMonth() + 1) + "-" + dt.getDate();
      };
      CurrencyRates.findOne({date: today}).then((reply) => {

        if (!reply) return updateCurrencyRate(today);
        return resolve(reply);
      }).catch((e) => {
        reject(e);
      });
  });
};

let updateCurrencyRate = function(today) {
  return new Promise(function(resolve, reject) {
    axios.get(`http://data.fixer.io/api/latest?access_key=5fbf8634befbe136512317f6d897f822`).then((reply) => {
      let currency = new CurrencyRates({
        timestamp: reply.data.timestamp,
        base  : reply.data.base,
        date  : today,
        rates : JSON.stringify(reply.data.rates)
      });
      console.log('saving new data fixer');
      return currency.save();
    }).then((reply) => {
      resolve(reply);
    }).catch((e) => {
      reject(e);
    });
  });
};

let testGoogleToken = function(req) {
  return new Promise(function(resolve, reject) {
    if (req.headers.accept == 'test_call') {
      resolve(true);
    };
    const client = new OAuth2Client(process.env.GoogleSignInKey);
    client.verifyIdToken({
        idToken: req.body.id_token,
        audience: process.env.GoogleSignInKey,
    }).then((ticket) => {
        const payload = ticket.getPayload();
        const userid = payload['sub'];
        resolve(true);
    }).catch((e) => {
        reject(e)
    });
  });
}


app.post('/signing',(req,res) => {

  if (req.body.query === 'create-currency-session') {
    createCurrencySession(req,req.body.msg).then((msg) => {
      console.log('currency session stored');
      req.session.currencyRates = msg;
      res.status(200).send(msg);
    }).catch((e) => {
      console.log(e);
      res.status(400).send(e);
    });

  }

  if (req.body.query === 'update-due') {
    if (req.body.type == 'push') {
      req.session.due.push(req.body.due);
    } else {
      req.session.due.splice(req.body.due, 1);
    };
    console.log(req.session.due);
    return res.status(200).send(req.session.due);
  };

  if (req.body.query === 'Register') {
    Users.findOne({"email": req.body.email}).then((result) => {
      if (result && result.SigninType != 'Google') return Promise.reject("An account with this email already exists, please sign in !");
      return Users.findOneAndUpdate({"email": req.body.email}, {$set : {"name":req.body.name, "password": 'fake_password'}}, {new: true, upsert: true});
    }).then((returned) => {
      if (!returned) return Promise.reject('User update failed. It should not fail. Please check this line !');
      returned.password = req.body.password;
      return returned.generateAuthToken(req);
    }).then((msg) => {
      res.status(200).send(msg.tokens[0].token);
    }).catch((e) => {
      console.log(e);
      return res.status(401).send(e);
    });
  };

  if (req.body.query === 'Google_ID') {
    testGoogleToken(req).then((res) => {
      return Users.findOneAndUpdate({"email": req.body.email}, {$set : {"name":req.body.name , "SigninType":'Google'}}, {new: true, upsert: true});
    }).then((returned) => {
      if (!returned) return Promise.reject('Invalid Request');
      return returned.generateAuthToken(req);
    }).then((returned) => {
      return res.status(200).send(returned.tokens[0].token);
    }).catch((e) => {
      console.log(e);
      if (e.code === 11000) return res.status(400).send('You are already registered with this email. Please Sign in.');
      return res.status(400).send(`${e}`);
    });

  };

  if (req.body.query === 'Login') {
    var user = _.pick(req.body,['email','password']);
    Users.findByCredentials(user.email, user.password).then((returned) => {
      if (!returned) return Promise.reject('Invalid credentials.')
      return returned.generateAuthToken(req);
    }).then((user) => {
      if (!user) return Promise.reject('Failed to Sign In.');
      return res.status(200).send(user.tokens[0].token);
    }).catch((e) => {
      console.log(e);
      res.status(404).send(e);
    });
  };

  if (req.body.query === 'Email_Verify') {
    var phoneCode = Math.floor(100000 + Math.random() * 900000);
    Users.findOne({"email":req.body.email}).then((user) => {
      if (!user) return res.status(404).send('Sorry, you never registered before with this email. Please sign up.');
      return sendmail(req.body.email,`Your Code is <b>${phoneCode}</b>, please enter it on webpage.`,'Make a story - Forgot Password')
    }).then((msg) => {
      return Users.findOneAndUpdate({"email": req.body.email}, {$set : {"phoneCode":phoneCode}}, {new: true});
    }).then((user) => {
      res.status(200).send('Mail sent !');
    }).catch((e) => {
      console.log(e);
      if (e.errno) return res.status(404).send(e.errno);
      res.status(400).send(`${e}`);
    });
  };

  if (req.body.query === 'Test_Code') {
    Users.findOne({
      "email": req.body.email,
      "phoneCode": req.body.code
    }).then((user) => {
      if (!user) return Users.findOneAndUpdate({"email":req.body.email},{$set: {attemptedTime: new Date()}, $inc:{wrongAttempts:1}},{new:true});
      console.log('user found', user);
      return Promise.resolve('Found');
    }).then((response) => {
      if (response === 'Found') return res.status(200).send('Verified !');
      console.log(`${response}:::: Wrong attempt no: ${response.wrongAttempts} x Attempt`);
      if (response.wrongAttempts > 4) return res.status(404).send('5 wrong attempts, please try again after 2 mins.');
      return res.status(400).send('Did not match !');
    }).catch((e) => {
      console.log(e);
      return res.status(400).send(e);
    });
  };

  if (req.body.query === 'new_password') {
    Users.findOne({
      "email": req.body.email,
      "phoneCode": req.body.code,
    }).then((user) => {
      if (!user) return Promise.reject('Un authorized request.');
      user.password = req.body.password;
      return user.generateAuthToken(req);
    }).then((response)=> {
      console.log(response);
      res.status(200).send('Password changed, please login with new password.');
    }).catch((e) => {
      console.log(e);
      res.status(404).send(e);
    });
  };

  if (req.body.query === 'subscription') {
    var subscription = new Subscription(
      _.pick(req.body,['email']),
    );
    subscription.save().then((result) => {
      return res.status(200).send(result);
    }).catch((e) => {
      if (e.code === 11000) return res.status(400).send('You are already subscribed with this email.');
      res.status(400).send(e);
    });
  }

  if (req.body.query === 'deleteMe') {
    console.log(req.body.token);
    Users.findByToken(req.body.token).then((user) => {
      console.log(req.body.id, user._id);
      return People.deleteOne({_id:req.body.id, addedBy: user._id});
    }).then((person) => {
      if (!person) return Promise.reject('Unauthorized request');
      res.status(200).send(person);
    }).catch((e) => {
      if (e.name == "JsonWebTokenError") return res.status(400).send('Please sign in to perform this action.');
      console.log(e);
      res.status(400).send(e)
    });
  }

});

serverRunning();


module.exports = {app,http,mongoose,People,Orders,CurrencyRates,Users};
