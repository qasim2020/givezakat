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
  console.log(req.query);
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

  if (!req.session.token) {
      return res.render('1-redirect.hbs',{
      timer: 3,
      page: 'No Session Found !',
      message: 'You are not logged in, redirecting you to home page',
    });
  };

  People.find({addedBy: req.params.user._id}).then((sponsored) => {
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

let getBasicData = function (req) {
  let regex = new RegExp(req.query.expression,'gi') || /pending|delivered|inprogress/gi;
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
          { "$match": {cardClass: regex} },
          { "$limit": Number(req.query.showQty) || 12 },
          { $addFields:
            {
              paidByMe: false,
              addedByMe: false,
              browserCurrency: req.session.browserCurrency && req.session.browserCurrency.currency_code || "USD"
            }
          }
        ]
        ,
        loadMore: [
                {$match: {cardClass: regex}},
                {$skip: Number(req.query.showQty) || 12},
                {$count: 'total'}
              ]
        ,
        rates: [
          {$limit: 1},
          { "$lookup": {
        from: 'currencyrates',
        pipeline: [
            {$match: {}},
            {$sort: {timestamp: -1} },
            {$limit: 1},
            {$project: {
                exchangeRate: "$rates",
                _id: 0
            }}
          ],
            as: 'rates'
        }},
        {$project: {
            exchangeRate: {$arrayElemAt: ["$rates.exchangeRate",0]},
            _id: 0
        }}
        ],
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
            people: "$people",
            rates: "$rates",
            exchangeRate: {$arrayElemAt: ["$rates.exchangeRate",0]},
            leftBehind: "$loadMore.total"
         }
    }
  ]
  );

};

// let updatePeople = function(req,o) {
//
//   if (!req.session.due) return o;
//
//   let updatedObjects = o.map(function(val) {
//
//     findPeople = req.session.due.filter(o => {
//       return o == val._id.toString();
//     });
//
//     if (findPeople.length > 0) val.dueIds = 'card-selected';
//
//     return val;
//
//   })
//
//   return updatedObjects;
// }

hbs.registerHelper("salarytext", function(salary, currency, browserCurrency, options) {
  if (!options.data) return;
  exchangeRate = JSON.parse(options.data.root.exchangeRate);
  let mySalaryInBrowsersCurrency = Math.floor(parseInt(exchangeRate[browserCurrency]) / parseInt(exchangeRate[currency]) * parseInt(salary));
  return `${mySalaryInBrowsersCurrency} ${browserCurrency} per Month`;
});

hbs.registerHelper("smallName",function(name,options) {
  return name.split(' ')[0].trim();
})

hbs.registerHelper("checkDue", function(value, options) {
  var found = options.data.root.due.find(function(elem) {
    return value == elem;
  })
  if (found) return 'card-selected';
  return '';
})

hbs.registerHelper("length", function(value, options) {
  if (!value) return 0;
  return value.length;
})

hbs.registerHelper("loadMore", function(query, leftBehind, options) {
  if (leftBehind > 0) return `<button encloser="show${query.type}Cards" my_href="${query.url}?showQty=${query.showQty}&expression=${query.expression}" class="load-more btn btn-primary d-flex align-items-center" type="button" name="button" style="margin:2rem auto; display: block; width: fit-content;">Load More (${leftBehind} left)</button>`;
  return `<a class="disabled load-more btn btn-primary d-flex align-items-center" type="button" name="button" style="margin:2rem auto; display: block; width: fit-content;">Thats it.</a>`;
})

hbs.registerHelper("unlocked", function(paid, added, options) {
  if (paid || added) return true;
  return false
})

hbs.registerHelper("checkloadMore", function(value) {
  if (value > 0) return true;
  return false;
})

app.get('/',(req,res) => {
  getBasicData(req).then(results => {

    if (req.headers['x-pjax']) return res.status(200).render('2-peopleBussinessCards.hbs',{
      data: results[0].people,
      due: req.session.due,
      exchangeRate: results[0].exchangeRate,
      count: {
        leftBehind: results[0].leftBehind
      },
      query: {
        url: '/',
        type: 'All',
        showQty: results[0].people.length+12,
        expression: req.query.expression
      }
    })

    let options = {
      data: results[0].people,
      due: req.session.due,
      currency: req.session.hasOwnProperty('browserCurrency'),
      count: {
        Total: results[0].Total || 0,
        pending: results[0].pending || 0,
        delivered: results[0].delivered || 0,
        inprogress: results[0].inprogress || 0,
        Sponsors: results[0].Sponsors,
        leftBehind: results[0].leftBehind
      },
      query: {
        url: '/',
        type: 'All',
        showQty: results[0].people.length+12,
        expression: req.query.expression || 'delivered|inprogress|pending'
      },
      exchangeRate: results[0].exchangeRate
    };

    if (req.headers.accept == process.env.test_call) return res.status(200).send(options);

    res.status(200).render('1-home.hbs', options);
  }).catch((e) => {
    console.log(e);
    res.status(400).send(e);
  });
});

let getLoggedInData = function(req) {
  let regex = new RegExp(req.query.expression,'gi') || /pending|delivered|inprogress/gi;
  return People.aggregate([
    {$facet :
        {
        Total : [
                { $match: {cardClass: /pending|delivered|inprogress/gi} },
                { $count: "added" }
                ]
        ,
        myTotal: [
                { $match: {cardClass: /pending|delivered|inprogress/gi ,addedBy: req.params.user._id.toString()} },
                { $count: "total" }
                ],
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
          { "$match": {cardClass: regex} },
          { "$limit": Number(req.query.showQty) || 12 },
          {$addFields: {stringId: {$toString: "$_id"} } },
          {$lookup: {
            from:  "orders",
            let: { newId: "$stringId", addedBy: "$addedBy"},
            pipeline: [
                { $match:
                     { $expr:
                        { $and : [
                            { $eq: [ "$paidto",  "$$newId" ] },
                            { $eq: [ "$paidby", req.params.user._id.toString()] }
                            ]
                        }
                     }
                  },
                {$count: "total"}
            ],
            as: "orders"
          }},
          {$addFields: {
            paidByMe: {
                $cond: {if: { $eq : [ { "$arrayElemAt": ["$orders.total",0] } ,1 ] },  then: true, else: false}
            },
            addedByMe: {
                $cond: { if: { $eq: [ "$addedBy", req.params.user._id.toString() ] }, then: true, else: false }
            },
            browserCurrency: req.session.browserCurrency && req.session.browserCurrency.currency_code || "USD"
          }},
          {$project: { orders: 0 }}
        ]
        ,
        rates: [
          {$limit: 1},
          { "$lookup": {
        from: 'currencyrates',
        pipeline: [
            {$match: {}},
            {$sort: {timestamp: -1} },
            {$limit: 1},
            {$project: {
                exchangeRate: "$rates",
                _id: 0
            }}
          ],
            as: 'rates'
        }},
        {$project: {
            exchangeRate: {$arrayElemAt: ["$rates.exchangeRate",0]},
            _id: 0
        }}
        ],
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
        ],
        loadMore: [
                {$skip: 12},
                {$match: {cardClass: /pending|delivered|inprogress/gi}},
                {$count: 'total'}
              ]
        }
    },
    {$project: {
            Total: { $arrayElemAt: [ "$Total.added", 0 ] } ,
            myTotal: { $arrayElemAt: [ "$myTotal.total", 0 ] } ,
            pending: { $arrayElemAt: [ "$Pending.pending", 0 ] } ,
            delivered: { $arrayElemAt: [ "$Delivered.delivered", 0 ] } ,
            inprogress: { $arrayElemAt: [ "$inprogress.inprogress", 0 ] } ,
            Sponsors: "$Sponsors",
            people: "$people",
            rates: "$rates",
            exchangeRate: {$arrayElemAt: ["$rates.exchangeRate",0]},
            leftBehind: "$loadMore.total"
         }
    }
  ])
}

let getPjaxMyData = function(req) {
  let regex = new RegExp(req.query.expression,'gi') || /pending|delivered|inprogress/gi;

  return People.aggregate([
    {$facet :
        {
        paidbyme: [
          { "$limit": 8 },
          { "$match": {cardClass: regex} },
          {$addFields: {stringId: {$toString: "$_id"} } },
          {$lookup: {
            from:  "orders",
            let: { newId: "$stringId", addedBy: "$addedBy"},
            pipeline: [
                { $match:
                     { $expr:
                        { $and : [
                            { $eq: [ "$paidto",  "$$newId" ] },
                            { $eq: [ "$paidby", req.params.user._id.toString()] }
                            ]
                        }
                     }
                  },
                {$count: "total"}
            ],
            as: "orders"
          }},
          {$addFields: {
            paidByMe: {
                $cond: {if: { $eq : [ { "$arrayElemAt": ["$orders.total",0] } ,1 ] },  then: true, else: false}
            },
            browserCurrency: req.session.browserCurrency && req.session.browserCurrency.currency_code || "USD"
          }},
          {$project: { orders: 0 }},
          {$match: { paidByMe : true }}
        ]
        ,
        addedbyme: [
          { "$limit": 8 },
          { "$match": {cardClass: regex, addedBy: req.params.user._id.toString()} },
          {$addFields: {
            addedByMe: true,
            browserCurrency: req.session.browserCurrency && req.session.browserCurrency.currency_code || "USD"
          }}
        ]
        ,
        rates: [
          {$limit: 1},
          { "$lookup": {
          from: 'currencyrates',
          pipeline: [
              {$match: {}},
              {$sort: {timestamp: -1} },
              {$limit: 1},
              {$project: {
                  exchangeRate: "$rates",
                  _id: 0
              }}
            ],
              as: 'rates'
          }},
          {$project: {
              exchangeRate: {$arrayElemAt: ["$rates.exchangeRate",0]},
              _id: 0
          }}
        ],
        loadMoreAddedByMe: [
          {$match: {cardClass: regex , addedBy: req.params.user._id.toString()}},
          {$skip: Number(req.query.showQty) || 8},
          {$count: 'total'}
        ],
        loadMorePaidByMe: [
          { "$match": {cardClass: regex} },
          {$addFields: {stringId: {$toString: "$_id"} } },
          {$lookup: {
            from:  "orders",
            let: { newId: "$stringId", addedBy: "$addedBy"},
            pipeline: [
                { $match:
                     { $expr:
                        { $and : [
                            { $eq: [ "$paidto",  "$$newId" ] },
                            { $eq: [ "$paidby", req.params.user._id.toString()] }
                            ]
                        }
                     }
                  },
                {$count: "total"}
            ],
            as: "orders"
          }},
          {$addFields: {
            paidByMe: {
                $cond: {if: { $eq : [ { "$arrayElemAt": ["$orders.total",0] } ,1 ] },  then: true, else: false}
            },
            browserCurrency: req.session.browserCurrency && req.session.browserCurrency.currency_code || "USD"
          }},
          {$project: { orders: 0 }},
          {$match: { paidByMe : true }},
          {$skip: Number(req.query.showQty) || 8},
          {$count: 'total'}
        ]
        }
    },
    {$project: {
            addedbyme: {
              people: "$addedbyme",
              leftBehind: "$loadMoreAddedByMe.total",
              query: {
                url: '/home',
                type: 'my',
                people: 'addedbyme',
                token: req.params.token,
                type: req.query.type,
                showQty: req.query.showQty+8,
                expression: req.query.expression
              },
            },
            paidbyme: {
              people: "$paidbyme",
              leftBehind: "loadMorePaidByMe.total",
              query: {
                url: '/home',
                type: 'my',
                people: 'paidbyme',
                token: req.params.token,
                type: req.query.type,
                showQty: req.query.showQty+8,
                expression: req.query.expression
              },
            },
            rates: "$rates",
            exchangeRate: {$arrayElemAt: ["$rates.exchangeRate",0]},
            leftBehind: "$loadMore.total"
         }
    }
  ])
}

app.get('/home', authenticate, (req,res) => {

  console.log('home entered');

  if (req.headers['x-pjax'] && req.query.type == 'my') {
    getPjaxMyData(req).then(results => {
      if (req.query.people == 'both') {
        console.log({people: results[0].addedbyme});
        console.log(`showing ${req.query.people} in pjax`);
        return res.status(200).renderPjax('2-peopleMyList.hbs',{
          due: req.session.due,
          exchangeRate: results[0].exchangeRate,
          addedbyme: results[0].addedbyme[0],
          paidbyme: results[0].paidbyme[0]
        })
      } else if (req.query.people == 'addedbyme') {
        console.log(`showing ${req.query.people} in pjax`);
        return res.status(200).renderPjax('2-peopleMyList.hbs',{
          due: req.session.due,
          exchangeRate: results[0].exchangeRate,
          addedbyme: results[0].addedbyme,
        })
      } else if (req.query.people == 'paidbyme') {
        console.log(`showing ${req.query.people} in pjax`);
        return res.status(200).renderPjax('2-peopleMyList.hbs',{
          due: req.session.due,
          exchangeRate: results[0].exchangeRate,
          paidbyme: results[0].paidbyme
        })
      } else {
        return Promise.reject('Sorry bad filter choice.')
      }

    }).catch(e => {
      console.log(e);
      // return res.status(400).send(e);
      return res.renderPjax('2-error.hbs',{msg: e});
    })
  } else {
    getLoggedInData(req).then(results => {

      if (req.headers['x-pjax'] && req.query.type == 'All') return res.status(200).renderPjax('2-peopleBussinessCards.hbs',{
        data: results[0].people,
        due: req.session.due,
        token: req.query.token,
        exchangeRate: results[0].exchangeRate,
        count: {
          leftBehind: results[0].leftBehind
        },
        query: {
          url: '/',
          type: req.query.type,
          showQty: results[0].people.length+12,
          expression: req.query.expression
        }
      })

      let options = {
        name: req.params.user.name,
        token: req.query.token,
        data: results[0].people,
        due: req.session.due,
        currency: req.session.hasOwnProperty('browserCurrency'),
        count: {
          Total: results[0].Total || 0,
          myTotal: results[0].myTotal || 0,
          pending: results[0].pending || 0,
          delivered: results[0].delivered || 0,
          inprogress: results[0].inprogress || 0,
          Sponsors: results[0].Sponsors,
          leftBehind: results[0].leftBehind
        },
        query: {
          url: '/',
          type: 'All',
          showQty: results[0].people.length+12,
          expression: req.query.expression || 'delivered|inprogress|pending',
          token: req.query.token,
        },
        exchangeRate: results[0].exchangeRate
      };

      if (req.headers.accept == process.env.test_call) return res.status(200).send(options);
      res.status(200).render('1-home.hbs', options);
    }).catch((e) => {
      console.log(e);
      res.status(400).send(e);
    });
  }

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
    return res.render( '1-redirect.hbs' , {
      timer: 10,
      page: 'Logged Out',
      message: 'You have successfully logged out. Thank you for visiting us !',
    });
  }).catch((e) => {
    console.log(e);
    res.status(404).send(e);
  });
});

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

let mySponsoredCount = function(req) {
  return People.aggregate([
    {
      $facet: {
        total: [
          {$match: {addedBy:req.params.user._id.toString()}},
          {$count: 'total'}
        ],
        pending: [
          {$match: {cardClass:'pending',addedBy:req.params.user._id.toString()}},
          {$count: 'total'}
        ],
        delivered: [
          {$match: {cardClass:'delivered',addedBy:req.params.user._id.toString()}},
          {$count: 'total'}
        ],
        inprogress: [
          {$match: {cardClass:'inprogress',addedBy:req.params.user._id.toString()}},
          {$count: 'total'}
        ],
    }
  },{
      $project: {
        total: {"$arrayElemAt": ["$total.total",0]},
        pending: {"$arrayElemAt": ["$pending.total",0]},
        delivered: {"$arrayElemAt": ["$delivered.total",0]},
        inprogress: {"$arrayElemAt": ["$inprogress.total",0]}
      }
    }
]);
}

let myOrdersCount = function(req) {
  return Orders.aggregate([
    {
      $facet: {
        total: [
          {$match: {paidby:req.params.user._id.toString()}},
          {$count: 'total'}
        ],
        pending: [
          {$match: {status:'pending',paidby:req.params.user._id.toString()}},
          {$count: 'total'}
        ],
        delivered: [
          {$match: {status:'delivered',paidby:req.params.user._id.toString()}},
          {$count: 'total'}
        ],
        inprogress: [
          {$match: {status:'inprogress',paidby:req.params.user._id.toString()}},
          {$count: 'total'}
        ],
    }
  },{
    $project: {
      total: {"$arrayElemAt": ["$total.total",0]},
      pending: {"$arrayElemAt": ["$pending.total",0]},
      delivered: {"$arrayElemAt": ["$delivered.total",0]},
      inprogress: {"$arrayElemAt": ["$inprogress.total",0]}
    }
  }
]);
}

let getFullCount = function() {
  return People.aggregate([
    {
      $facet: {
        total: [
          {$match: {} },
          {$count: 'total'}
        ],
        pending: [
          {$match: {cardClass:'pending'}},
          {$count: 'total'}
        ],
        delivered: [
          {$match: {cardClass:'delivered'}},
          {$count: 'total'}
        ],
        inprogress: [
          {$match: {cardClass:'inprogress'}},
          {$count: 'total'}
        ],
    }
  },{
    $project: {
      total: {"$arrayElemAt": ["$total.total",0]},
      pending: {"$arrayElemAt": ["$pending.total",0]},
      delivered: {"$arrayElemAt": ["$delivered.total",0]},
      inprogress: {"$arrayElemAt": ["$inprogress.total",0]}
    }
  }
]);
}

app.get('/getFullCount', (req,res) => {

  getFullCount().then(msg => {
    let options = {
      Total: (msg[0]['total'] || 0),
      pending: (msg[0]['pending'] || 0),
      delivered: (msg[0]['delivered'] || 0),
      inprogress: (msg[0]['inprogress'] || 0),
    }
    res.status(200).send(options);
  }).catch(e => res.status(400).send(e));
})

app.get('/getCount', authenticate, (req,res) => {

  Promise.all([mySponsoredCount(req),myOrdersCount(req)]).then(msg => {
    let options = {
      myTotal: (msg[0][0]['total'] || 0) + (msg[1][0]['total'] || 0),
      pending: (msg[0][0]['pending'] || 0) + (msg[1][0]['pending'] || 0),
      delivered: (msg[0][0]['delivered'] || 0) + (msg[1][0]['delivered'] || 0),
      inprogress: (msg[0][0]['inprogress'] || 0) + (msg[1][0]['inprogress'] || 0),
    }
    res.status(200).send(options);
  }).catch(e => res.status(400).send(e));
})

app.get('/peopleBussinessCards',(req,res) => {
  return;
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
      return res.renderPjax('2-error.hbs',{ msg: e.msg });
    })
  }

});

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
