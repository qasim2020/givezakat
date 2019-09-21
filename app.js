require('./config/config');

const http = require('http');
const express = require('express');
const pjax    = require('express-pjax');
const session = require('express-session');
const MongoStore = require('connect-mongo')(session);
const bodyParser = require('body-parser');
const hbs = require('hbs');
var cookieParser = require('cookie-parser')
const _ = require('lodash');
const readXlsxFile = require('read-excel-file/node');
const axios = require('axios');
const {OAuth2Client} = require('google-auth-library');

const stripe = require('stripe')(process.env.stripePrivate);

const {sheet} = require('./server/sheets.js');
const {mongoose} = require('./db/mongoose');
const {People} = require('./models/people');
const {Orders} = require('./models/orders');
const {CurrencyRates} = require('./models/currencyrates');
const {Users} = require('./models/users');
const {sendmail} = require('./js/sendmail');
const {serverRunning,checkCurrencyExists} = require('./js/serverRunning');
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
  cookie: {
    maxAge:5 * 60 * 1000,
  },
  rolling: true,
  store: new MongoStore({ mongooseConnection: mongoose.connection })
}))
app.set('view engine','hbs');
hbs.registerPartials(__dirname + '/views/partials');
hbs.registerHelper("inc", function(value, options) {
    return parseInt(value) + 1;
});
app.use(function(req, res, next) {
  if (!req.session.due) req.session.due = [];
  if (req.headers.accept != process.env.test_call) console.log('SESSION STATE', Object.keys(req.session));
  next();
});

let authenticate = (req,res,next) => {
  let token = req.params.token || req.body.token || req.query.token;
  if (!token) return res.status(400).render('1-redirect.hbs', {
    timer: 3,
    message: 'You are not signed in to perform this action',
    page: 'Un authorized Request'
  });
  Users.findByToken(token).then((user) => {
    if (!user) return Promise.reject('No user found with the requested token !');
    req.params.user = user;
    next();
  }).catch((e) => {
    console.log(e);
    res.status(400).render('1-redirect.hbs',{
      timer: 3,
      message: e,
      page: 'Error',
    })
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
  return People.aggregate(
    [
    {$facet :
        {
        Total : [
                { $match: {} },
                { $count: "added" }
                ]
        ,
        Pending: [
                { $match: {cardClass: "pending"} },
                { $count: "pending" }
                ]
        ,
        Delivered: [
                { $match: {cardClass: "delivered"} },
                { $count: "delivered" }
                ]
        ,
        inprogress: [
                { "$match" : { cardClass: 'inprogress'}},
                { "$count": "inprogress" },
                ]
        ,
        people: [
          { "$limit": 12 },
          { "$match": {} }
        ]
        ,
        Sponsors : [
                { $match: {} },
                { $group: {_id: "$addedBy", people: { $sum: Number(1) } } },
                { $addFields: { addedBy: { $toObjectId: "$_id" } } },
                { $lookup: {
                    from: 'users',
                    localField: "addedBy",
                    foreignField: "_id",
                    as: "users"
                } },
                { $project: {
                    name: { $arrayElemAt: ["$users.name",0] },
                    sponsored: "$people"
                    } }
                ]
        }
    },
    {$project: {
            Total: { $arrayElemAt: [ "$Total.added", 0 ] } ,
            pending: { $arrayElemAt: [ "$Pending.pending", 0 ] } ,
            delivered: { $arrayElemAt: [ "$Delivered.delivered", 0 ] } ,
            inprogress: { $arrayElemAt: [ "$inprogress.inprogress", 0 ] } ,
            Sponsors: "$Sponsors",
            people: "$people"
         }
    }
  ]
  );

};

let updatePeople = function(req,o) {

  if (!req.session.due) return o;

  let updatedObjects = o.map(function(val) {

    findPeople = req.session.due.filter(o => {
      return o == val._id.toString();
    });

    if (findPeople.length > 0) val.dueIds = 'card-selected';

    return val;

  })

  return updatedObjects;
}

app.get('/',(req,res) => {

  getCount().then(results => {

    if (req.session.browserCurrency) {
      getEachSalaryText(results[0].people,req);
    } else {
      _.each(results[0].people,(val,key) => {
        val.salary = `${val.salary} ${val.currency} per month`;
      });
    }

    _.each(results[0].Sponsors,(val,key) => {
      val.name = val.name.split(' ')[0].trim();
    })
// console.log(results[0]);
    let updatedObjects = updatePeople(req,results[0].people);

    let options = {
      data: updatedObjects,
      due: req.session.due && req.session.due.length,
      currency: req.session.hasOwnProperty('browserCurrency'),
      count: {
        Total: results[0].Total,
        pending: results[0].pending,
        delivered: results[0].delivered,
        inprogress: results[0].inprogress,
        Sponsors: results[0].Sponsors
      },
    };
    if (req.headers.accept == process.env.test_call) return res.status(200).send(options);
    res.status(200).render('1-home.hbs', options);
  }).catch((e) => {
    console.log(e);
    res.status(400).send(e);
  });
});

app.get('/home/:token', authenticate, (req,res) => {

  let promise1 = new Promise(function(resolve, reject) {
    return getCount().then(msg => {
      resolve(msg);
    })
  });
  let promise2 = new Promise(function(resolve, reject) {
    return People.find().limit(12).lean().then(people => {
      resolve(people);
    })
  });
  let promise3 = new Promise(function(resolve, reject) {
    return Orders.find({paidby: req.params.user._id}).lean().then(paid => resolve(paid));
  });

  Promise.all([promise1, promise2, promise3]).then(results => {

    if (req.session.browserCurrency) {
      getEachSalaryText(results[1],req);
    } else {
      _.each(results[1],(val,key) => {
        val.salary = `${val.salary} ${val.currency} per month`;
      });
    }
    req.results = results;
    let ids = [];
    _.each(results[2],(val,key) => {
      ids.push(val.paidto);
    });

    return People.find({_id: {$in : ids}}).lean();
  }).then((msg) => {

    req.paidpeople = msg;

    let values = {};

    let updatedObjects = req.results[1].map(function(val) {

      val.paidbyme = msg.filter(o => {
                        return o._id.toString() === val._id.toString();
                      })[0];

      if (val.addedBy == req.params.user._id) val.addedbyme = true;
      else val.addedbyme = false;

      if (val.addedbyme || val.paidbyme && Object.keys(val.paidbyme).length > 0) {
        val.unlocked = true;
      }
      else val.unlocked = false;
      return val;

    });

    updatedObjects = updatePeople(req,updatedObjects);
    let options = {
      data: updatedObjects,
      token: req.session.token,
      name: req.params.user.name,
      due: req.session.due && req.session.due.length,
      currency: req.session.hasOwnProperty('browserCurrency'),
      count: req.results[0][0]
    };
    if (req.headers.accept == process.env.test_call) res.status(200).send(options);
    res.status(200).render('1-home.hbs',options);
  }).catch((e) => {
    console.log('home page error', e);
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

app.get('/updateperson', authenticate, (req,res) => {

  console.log(req.query);

  People.findOne({_id:req.query.id, addedBy: req.params.user._id}).lean().then(msg => {
    if (!msg) return Promise.reject('This person was not added by you. You can update only people added by you !');
    return res.status(200).render('1-updateperson.hbs',msg);
  }).catch(e => {
    res.status(400).render('1-redirect.hbs',{
      message: e,
      token: req.params.token,
      page: 'Update Person',
    })
  })

  // if (!(req.session.token)) return res.render('1-signin.hbs',{
  //   signin: 'active',
  //   message: 'You need to sign in to add people.',
  //   call: 'addpeople',
  // });
  //
  // res.render('1-updateperson.hbs',{
  //   // due: 'active',
  //   // url: result.data.response.url,
  //   addpeople: 'active',
  //   token: req.session.token,
  //   name: req.session.name,
  //   call: req.params.call.split('+').join(' '),
  // });
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
  console.log(req.session.browserCurrency.currency_code.toLowerCase());
  return People.find({'_id' : {$in : objectIdArray}}).lean().then((msg) => {
      _.each(msg,val => {
        val.localCurrency = req.session.browserCurrency.currency_code;
      });
      res.render('1-due.hbs',{
        people: msg,
        dueStatus: 'active',
        due: req.session.due && req.session.due.length,
        token: req.session.token,
        name: req.session.name,
        email: req.params.user.email,
        localCurrency: req.session.browserCurrency.currency_code
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
    let objectIdArray = paymentDetails.map(s => s.id);
    People.find({'_id' : {$in : objectIdArray}}).then((msg) => {
      req.people = msg;
      return Users.findByToken(req.query.token);
    }).then((user) => {
      if (!user) return Promise.reject('User has not logged in because no token is associated to this request !');
      let array = [];
      let values = {};
      _.each(req.people,(val,key) => {
        values = {};
        values.paidby = user._id.toString();
        values.paidto = val._id.toString();
        values.amount = paymentDetails.filter(obj => {
                            return obj.id === val._id.toString();
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

  // stripe.products.create({
	//       name: 'T-shirt',
	//       type: 'good',
  //       description: 'Comfortable cotton t-shirt',
  //       attributes: ['size', 'gender']
  // }).then((msg) => {
  stripe.customers.create({
      email: req.query.email,
      source: req.query.stripeToken
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
    let options = {
      dueStatus: 'active',
      due: req.session.due && req.session.due.length,
      token: req.session.token,
      name: req.session.name,
      receipt: req.charge.receipt_url,
      payed: req.people
    };
    if (req.headers.accept == process.env.test_call) res.status(200).send(options);
    res.status(200).render('1-charge.hbs',options);
  }).catch(err => {
    console.log(err);
    res.status(400).render('1-redirect.hbs',{
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

app.get('/logout/:token', authenticate, (req,res) => {
  console.log(req.params.user.name,'logged out');
  let user = req.params.user;
  user.removeToken(req.params.token).then((user) => {
    req.session.destroy();
    return res.render('1-redirect.hbs',{
      timer: 10,
      page: 'You have been logged out !',
      message: 'Redirecting you to home page',
    });
    // return req.session.destroy(function(err) {
    //   req.url = '/';
    //   return app._router.handle(req, res);
    // });
  }).catch((e) => {
    console.log(e);
    res.status(404).send(e);
  });
});

// salarytext
let getEachSalaryText = function(msg,req) {
  let browserCurrencyRate = 0, thisPersonsCurrencyRate = 0 , mySalaryInBrowsersCurrency = 0;

  try {
    JSON.parse(req.session.currencyRates && req.session.currencyRates.rates)[req.session.browserCurrency && req.session.browserCurrency.currency_code];
  } catch(e) {
    return console.log(e);
  }
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

    return People.find({cardClass: regex}).limit(parseInt(req.query.showQty)).lean().then((msg) => {
      if (!msg || msg.length < 1) return Promise.reject({code: 404,msg: 'Did not find any people for this filter !'});
      req.data = updatePeople(req,msg);
      req.data = getEachSalaryText(req.data,req);
      if (req.query.token.length <  30) return Promise.reject({code: 404,msg: 'No user found, showing all data as locked !'});
      return Users.findByToken(req.query.token);
    }).then((user) => {
      if (!user) return Promise.reject('No user logged in found.');
      req.loggedIn = user;
      return Orders.find({paidby: req.loggedIn._id});
    }).then((msg) => {
      let ids = [];
      _.each(msg,(val,key) => {
        ids.push(val.paidto);
      });
      return People.find({_id: {$in : ids}}).lean();
    }).then((msg) => {
      req.paidpeople = msg;
      let values = {};
      //// TODO:
      req.data = req.data.map(function(val) {

        val.paidbyme = msg.filter(o => {
                          return o._id.toString() === val._id.toString();
                        })[0];

        if (val.addedBy == req.loggedIn._id) val.addedbyme = true
        else val.addedbyme = false;

        if (val.addedbyme || val.paidbyme && Object.keys(val.paidbyme).length > 0) {
          val.unlocked = true;
        }
        else val.unlocked = false;

        return val;

      });

      let options = {
        data: req.data,
        query: req.query
      }
      if (req.headers.accept == `${process.env.test_call}`) return res.status(200).send(options);
      console.log('loading people cards');
      return res.renderPjax('2-peopleBussinessCards.hbs',options);
    }).catch((e) => {
      console.log(e)
      if (e.code == 404) return res.renderPjax('2-peopleBussinessCards.hbs',{
        data: req.data,
        query: req.query,
        message: e.msg,
        token: req.session.token
      });
      return res.renderPjax('2-error.hbs',{msg: e});
    });

  };

  if (req.query.type == 'my') {

    if (!req.query.token) return res.renderPjax('2-error.hbs',{msg: 'You are not logged in. Please log in to view people you have sponsored and your orders !'});

    return Users.findByToken(req.query.token).then((user) => {
      if (!user) Promise.reject({code: '404',msg: 'Please log in to make this request !'});
      req.loggedIn = user;
      return People.find({addedBy: user._id, cardClass: regex}).limit(parseInt(req.query.showQty)).lean();
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
        ids.push(val.paidto);
      });
      return People.find({_id: {$in: ids}, cardClass: regex});
    }).then((peopleOrderedByMe) => {
      _.each(peopleOrderedByMe,(val,key) => {
        val.paidbyme = true;
        val.unlocked = true;
      });
      req.paidbyme = getEachSalaryText(peopleOrderedByMe,req);
      let options = {
        paidbyme: req.paidbyme,
        addedbyme: req.addedbyme,
        query: req.query,
      }
      if (req.headers.accept == process.env.test_call) return res.status(200).send(options);
      return res.renderPjax('2-peopleMyList.hbs',options);
    }).catch((e) => {
      console.log(e);
      // if (e.code == 404) return res.renderPjax('2-peopleMyList.hbs',{ data: req.data, query:req.query });
      return res.renderPjax('2-error.hbs',{ msg: e.msg });
    })
  }

});

let createCurrencySession = function(req,currency) {
  return new Promise(function(resolve, reject) {


  });
};

let testGoogleToken = function(req) {
  return new Promise(function(resolve, reject) {
    if (req.headers.accept == process.env.test_call) {
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
      req.session.browserCurrency = {currency_code: req.body.msg};
      checkCurrencyExists().then(ok => {
        req.session.currencyRates = ok;
        return res.status(200).send(ok);
      }).catch(e => {
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
    return res.status(200).send(req.session.due);
  };

  if (req.body.query === 'Register') {
    Users.findOne({
      "email": req.body.email,
      "phoneCode": req.body.phoneCode
    }).then((result) => {
      if (!result) return Promise.reject('You need to verify your email before proceeding forward !');
      if (result && result.SigninType != 'Google') return Promise.reject("An account with this email already exists, please sign in !");
      return Users.findOneAndUpdate({"email": req.body.email}, {$set : {
        "name":req.body.name,
        "password": 'fake_password',
        "phoneCode": process.env.phoneCode,
        "SigninType": 'Manual'
      }}, {new: true, upsert: true});
    }).then((returned) => {
      if (!returned) return Promise.reject('User update failed. It should not fail. Please check this line !');
      returned.password = req.body.password;
      return returned.generateAuthToken(req);
    }).then((msg) => {
      return res.status(200).send(msg.tokens[0].token);
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
    if (req.headers.accept == process.env.test_call) req.body.phoneCode = phoneCode;
    Users.findOne({"email":req.body.email}).then((user) => {
      if (req.body.registerNew) {
        let user = new Users({name: req.body.name, email: req.body.email, SigninType: 'Google'});
        return user.save().catch(e => Promise.reject('You are already registered !'));
      }
      if (!user) return Promise.reject('Sorry you have not registered with this email before, please Sign up !');
      return Promise.resolve(user);
    }).then(newUser => {
      sendmail(req.body.email,`Your Email Code: <b>${phoneCode}</b>, please enter it on webpage.`,'Zakat Lists');
      return Users.findOneAndUpdate({"email": req.body.email}, {$set : {"phoneCode":phoneCode}}, {new: true});
    }).then((user) => {
      res.status(200).send({msg: 'Mail sent !', phoneCode: req.body.phoneCode});
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
      return Promise.resolve('Found');
    }).then((response) => {
      console.log(response);
      if (response === 'Found') return res.status(200).send('Verified !');
      if (!response) return Promise.reject('could not add this user due to some thing');

      if (response.wrongAttempts > 4 && req.headers.accept != process.env.test_call) return res.status(404).send('5 wrong attempts, please try again after 2 mins.');
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
