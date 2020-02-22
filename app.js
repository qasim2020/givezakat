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
const moment = require('moment');


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
const {CountryInfo} = require('./models/countryinfo');

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
  console.log(req.query);
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
  readXlsxFile(__dirname+'/static/dashboard.xlsx').then((rows) => {
    let sorted = rows.map((val) =>
      val.reduce((total,inner,index) => {

        if (inner) Object.assign(total,{
          [rows[0][index]]: inner
        })
        return total;
      },{})
    ).filter((val,index) => index != 0);

    console.log(sorted);
    sorted = sorted.map(val => {
      if (!val.type) return;
      val.Content = val.Content.split('\r\n').map(val => {
        console.log(val, val.split(': ')[0].indexOf('.'));
        return {
          type: val.split(': ')[0].indexOf('.') != -1 ? val.split(': ')[0].split('.')[0] : val.split(': ')[0],
          msg: val.split(': ')[1].trim(),
          class: val.split(': ')[0].indexOf('.') != -1 ? val.split(': ')[0].split('.')[1] : ''
        }
      });
      return val;
    })

    console.log(sorted);
    res.render('1-home_new.hbs',{data: [
    {type:'person',width:2, height:1, msg:[
      {type: 'img', msg: 'magazine/person.png'},
      {type: 'facebook', msg: 'facebook.com/zakatlists'},
      {type: 'twitter', msg: 'twitter.com/zakatlists'},
      {type: 'makerlog', msg: 'makerlog.com/@punch__lines'},
      {type: 'intro', msg: 'He is a good boy, working hard to make zakatlists work. 💪'},
      {type: 'url', msg: 'https://www.zakatlists.com'},
    ]},
    {type:'blog', width:2, height:1, msg:[
      {type: 'h3', msg: 'What I grasped from Surah Fatiha?'},
      {type: 'p', msg: "I have made a commitment to read quran daily this year. Grasp its meanng. How it talks to me. Where is the Wow factor in it. I want to keep these tafaseer and discussions safe. Thus, I am starting this project where I will try to share, How I felt each day's message of Quran."},
      {type: 'date', msg: '1 Jan 2020'},
      {type: 'author', msg: 'Qasim'}
    ]},
    {type:'course', width:2, height:2, courses:[
      {course: "STQA", active: true, name: "Software Testing and Quality Assurance"},
      {course: "ATOC", active: false, name: "Advanced Theory of Computation"},
      {course: "AOS", active: false, name: "Advanced Operating Systems"},
    ]},
    {type:'signin', width:2, height:1, msg:[
      {type: 'h3', msg: 'Sign up to get unlimited access to the entire content of zakatlists', class:"width-half"},
      {type: 'button', msg: 'Sign In', class: 'primary'},
      {type: 'button', msg: 'Sign Up for Rs 300 / Month', class:'secondary'},
    ]},
    {type:'meetup', width:2, height:1, msg:[
      {type: 'h3', msg: "Meetup coming in"},
      {type: 'date', msg: "1 Mar 2020"},
      {type: 'button', msg: 'Speak', class: "default"},
      {type: 'button', msg: 'Attend', class: "default"},
      {type: 'button', msg: 'Details', class: "default"},
    ]},
    {type:'subscribe', width:2, height:1, msg:[
      {type: 'h6', msg: "Subscribe to stay tuned to zakatlists"},
      {type: 'input', msg: "enter your email here"},
      {type: 'button', msg: "Submit", class: "default"},
    ]},
    {type:'footer', width:6, height:1, msg:[
      {type: 'p', msg: "Eat from their fruits, and give the due alms on the day of harvest. <br> - Al Quran 6:141", class: "small"},
      {type: 'facebook', msg: 'facebook.com/zakatlists'},
      {type: 'twitter', msg: 'twitter.com/zakatlists'},
      {type: 'makerlog', msg: 'makerlog.com/@punch__lines'},
    ]}
  ]});
}).catch(e => res.status(400).send(e));
});

app.get('/profile/:token',authenticate,(req,res) => {

  if (!req.session.token) {
      return res.render('1-redirect.hbs',{
      timer: 3,
      page: 'No Session Found !',
      message: 'You are not logged in, redirecting you to home page',
    });
  };

  req.query.showQty = 1000;

  getPjaxMyData(req).then(results => {
    console.log(results[0].addedbyme[0]);
    res.status(200).render('1-profile.hbs',{
      token: req.params.token,
      name: req.params.user.name,
      email: req.params.user.email,
      phone: req.params.user.phone,
      profile: 'active',
      data: results[0].addedbyme[0],
      due: req.session.due,
      payed: results[0].paidbyme[0],
      exchangeRate: results[0].exchangeRate
    });
  }).catch(e => {
    console.log(e);
    res.render('1-redirect.hbs',{
      timer: 6,
      page: 'No Session Found !',
      message: e,
      token: req.session.token,
    });
  })
});

let getBasicData = function (req) {
  return People.aggregate(
    [
    {$facet :
        {
        Total : [
                { $match: {}},
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
          { "$match": req.match },
          { "$limit": Number(req.query.showQty) || 12 },
          { $addFields:
            {
              paidByMe: false,
              addedByMe: false,
              browserCurrency: req.session.browserCurrency && req.session.browserCurrency.currency_code || "USD",
              addedBy: { $toObjectId: "$addedBy" }
            }
          },
          { $lookup: {
              from: 'users',
              localField: "addedBy",
              foreignField: "_id",
              as: "users"
          } },
          { $addFields: {
              sponsorName: {$arrayElemAt: ["$users.name",0]},
              sponsorEmail:{$arrayElemAt: ["$users.email",0]},
              sponsorMob: {$arrayElemAt: ["$users.mob",0]},
              sponsorAddress: {$arrayElemAt: ["$users.sponsorAddress",0]},
              sponsorAccountBank: {$arrayElemAt: ["$users.sponsorAccountBank",0]},
              sponsorAccountNo: {$arrayElemAt: ["$users.sponsorAccountNo",0]},
              sponsorOtherMeans: {$arrayElemAt: ["$users.sponsorOtherMeans",0]}
          }},
          { $project: {
            users: 0
          }}
        ]
        ,
        loadMore: [
                {$match: req.match},
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
                {
                  $project: {
                    name: { $arrayElemAt: ["$users.name",0] },
                    flag: { $arrayElemAt: ["$users.flag",0] },
                    verified: { $arrayElemAt: ["$users.verified",0] },
                    sponsored: "$people",
                    caller: req.query.user && req.query.user.split(',')[0] || '',
                  }
                }
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

hbs.registerHelper("getTimeFromId", function(value) {
  return mongoose.Types.ObjectId(value).getTimestamp()
})

hbs.registerHelper("matchWithCaller", function(value1,value2,options) {
  if (value1 == value2) return 'active';
  return '';
})

hbs.registerHelper("checkActiveSponsor", function(sponsors) {
  if (sponsors._id == sponsors.caller) return '';
  return 'd-none';
})

hbs.registerHelper("salarytext", function(salary, currency, browserCurrency, options) {
  if (!options.data) return;
  if (options.data.root.exchangeRate == '') return `${salary} ${currency} per Month`;
  exchangeRate = JSON.parse(options.data.root.exchangeRate);
  let mySalaryInBrowsersCurrency = Math.floor(parseInt(exchangeRate[browserCurrency]) / parseInt(exchangeRate[currency]) * parseInt(salary));
  return `${mySalaryInBrowsersCurrency} ${browserCurrency} per Month`;
});

hbs.registerHelper("smallName",function(name,options) {
  // console.log(name);
  if (!name) return 'Unknown';
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

  if (leftBehind > 0) return `<button encloser="show${query.type}Cards" my_href="${query.url}?token=${query.token}&type=${query.type}&showQty=${query.showQty}&expression=${query.expression}&user=${query.username}" class="load-more btn btn-primary d-flex align-items-center" type="button" name="button" style="margin:2rem auto; display: block; width: fit-content;">Load More (${leftBehind} left)</button>`;
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

  console.log({user: req.query.user, url: req.url});

  let user = req.query.user || '';
  if (user.indexOf(',') != -1) {
    user = user.split(',');
    user = {$in : user}
  } else {
    user = {$exists: true}
  }

  let regex = req.query.expression || "pending|delivered|inprogress";

  req.match = {
    cardClass: new RegExp(regex,'gi'),
    addedBy: user
  }

  getBasicData(req).then(results => {

    if (req.headers['x-pjax']) {

      let options = {
        data: results[0].people,
        due: req.session.due,
        exchangeRate: results[0].exchangeRate,
        count: {
          leftBehind: results[0].leftBehind
        },
        query: {
          username: req.query.user || '',
          url: '/',
          type: 'All',
          showQty: parseInt(req.query.showQty)+12,
          expression: req.query.expression
        }
      };
      if (req.headers.accept == process.env.test_call) return res.status(200).send(options);
      return res.status(200).render('2-peopleBussinessCards.hbs',options);

    }

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
        username: req.query.user || '',
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
          { "$match": req.match },
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
            browserCurrency: req.session.browserCurrency && req.session.browserCurrency.currency_code || "USD",
            token: req.query.token,
            addedBy: {$toObjectId: "$addedBy"}
          }},
          {$project: { orders: 0 }},
          { $lookup: {
              from: 'users',
              localField: "addedBy",
              foreignField: "_id",
              as: "users"
          } },
          { $addFields: {
              sponsorName: {$arrayElemAt: ["$users.name",0]},
              sponsorEmail:{$arrayElemAt: ["$users.email",0]},
              sponsorMob: {$arrayElemAt: ["$users.mob",0]},
              sponsorAddress: {$arrayElemAt: ["$users.sponsorAddress",0]},
          }},
          { $project: {
            users: 0
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
                {
                  $project: {
                    name: { $arrayElemAt: ["$users.name",0] },
                    flag: { $arrayElemAt: ["$users.flag",0] },
                    verified: { $arrayElemAt: ["$users.verified",0] },
                    sponsored: "$people",
                    caller: req.query.user && req.query.user.split(',')[0] || '',
                  }
                }
        ],
        loadMore: [
                {$match: req.match},
                {$skip: Number(req.query.showQty) || 12},
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
            browserCurrency: req.session.browserCurrency && req.session.browserCurrency.currency_code || "USD",
            token: req.query.token,
            addedBy: {$toObjectId: "$addedBy"}
          }},
          {$project: { orders: 0 }},
          {$match: { paidByMe : true }},
          { $lookup: {
              from: 'users',
              localField: "addedBy",
              foreignField: "_id",
              as: "users"
          } },
          { $addFields: {
              sponsorName: {$arrayElemAt: ["$users.name",0]},
              sponsorEmail:{$arrayElemAt: ["$users.email",0]},
              sponsorMob: {$arrayElemAt: ["$users.mob",0]},
              sponsorAddress: {$arrayElemAt: ["$users.sponsorAddress",0]},
          }},
          { $project: {
            users: 0
          }}
          // { "$limit": parseInt(req.query.showQty) || 8 },
        ]
        ,
        addedbyme: [
          { "$match": {cardClass: regex, addedBy: req.params.user._id.toString()} },
          {$addFields: {
            addedByMe: true,
            browserCurrency: req.session.browserCurrency && req.session.browserCurrency.currency_code || "USD",
            token: req.query.token,
            sponsorName: req.params.user.name,
            sponsorEmail:req.params.user.email,
            sponsorMob: req.params.user.mob,
            sponsorAddress: req.params.user.sponsorAddress,
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
        ]
      }},
    {$project: {
            addedbyme: {
              people: "$addedbyme",
            },
            paidbyme: {
              people: "$paidbyme",
            },
            rates: "$rates",
            exchangeRate: {$arrayElemAt: ["$rates.exchangeRate",0]},
         }
       }
  ])
}

app.get('/home', authenticate, (req,res) => {

  console.log({home_query: req.query});

  let user = req.query.user || '';
  if (user.indexOf(',') != -1) {
    user = user.split(',');
    user = {$in : user}
  } else {
    user = {$exists: true}
  }

  let regex = req.query.expression || "pending|delivered|inprogress";

  req.match = {
    cardClass: new RegExp(regex,'gi'),
    addedBy: user
  }

  let options = {};

  if (req.headers['x-pjax'] && req.query.type == 'my') {
    req.query.showQty = 1000;
    getPjaxMyData(req).then(results => {
      if (req.query.people == 'both') {
        console.log(`showing ${req.query.people} in pjax`);
        options = {
          due: req.session.due,
          exchangeRate: results[0].exchangeRate,
          addedbyme: results[0].addedbyme[0],
          paidbyme: results[0].paidbyme[0],
        };
      }

      if (options && req.headers.accept == process.env.test_call) return res.status(200).send(options);
      else if (options) return res.status(200).renderPjax('2-peopleMyList.hbs',options)
      else Promise.reject('Sorry bad filter on pjax request');

    }).catch(e => {
      console.log(e);
      return res.renderPjax('2-error.hbs',{msg: e});
    })
  } else {
    getLoggedInData(req).then(results => {

      if (req.headers['x-pjax'] && req.query.type == 'All') {
        options = {
          data: results[0].people,
          due: req.session.due,
          token: req.query.token,
          exchangeRate: results[0].exchangeRate,
          count: {
            leftBehind: results[0].leftBehind
          },
          query: {
            username: req.query.user || '',
            url: '/home',
            type: req.query.type,
            showQty: results[0].people.length+12,
            expression: req.query.expression,
            token: req.query.token
          },
        };
        if (req.headers.accept == process.env.test_call) return res.status(200).send(options);
        return res.status(200).renderPjax('2-peopleBussinessCards.hbs',options);
      }

      options = {
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
          username: req.query.user || '',
          url: '/home',
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
  console.log(req.params.call, req.query);
  let options = {};
  if (req.params.call != 'home') {
    options = {
      signin: 'active',
      call: `${req.params.call}`,
      query: `${req.query.id}`,
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

hbs.registerHelper('hasError',(value,options) => {
  if (!value)return 'hasError';
  return '';
})

app.post('/updateUser',authenticate,(req,res) => {
  Users.updateOne({
    _id: req.params.user._id,
  }, {
    $set: {
      name: req.body.name,
      email: req.params.user.email,
      username: req.body.username,
      sponsorAddress: req.body.sponsorAddress,
      mob: req.body.mob,
      sponsorAccountTitle: req.body.sponsorAccountTitle,
      sponsorAccountBank: req.body.sponsorAccountBank,
      sponsorAccountNo: req.body.sponsorAccountNo,
      sponsorAccountIBAN: req.body.sponsorAccountIBAN,
      specialNote: req.body.specialNote,
      flag: req.body.flag
      }
    },{
      upsert: false
    }
  ).then(msg => {
    res.status(200).send(msg)
  }).catch(e => {
    console.log(e);
    res.status(400).send(e);
  });
})

app.get('/addpeople',authenticate,(req,res) => {

  let reqKeys = [
    'mob',
    'sponsorAccountTitle',
    'sponsorAccountBank',
    'sponsorAccountNo',
    'sponsorAccountIBAN',
    'specialNote',
    'flag',
    'username',
    'sponsorAddress'
  ];

  let validUser = reqKeys.every((value,index,arr) => {
    // console.log({value, status: req.params.user[value].length > 0});
    return req.params.user[value] && req.params.user[value].length > 0;
  })

  console.log(validUser, req.params.user);

  if (!validUser) {
    return CountryInfo.aggregate([
    { $match: {} },
    { $project: {
        name: "$name",
        callingCodes: {$arrayElemAt: ["$callingCodes",0]},
        currency: {$arrayElemAt: ["$currencies.code",0]},
        alpha2Code: "$alpha2Code"
        }}
    ]).then(msg => {
      return res.status(300).render('1-sponsor.hbs', {countryinfo: msg, data: req.params.user, token: req.query.token, route: '/addpeople'});
    }).catch(e => {
      console.log(e);
      return res.status(400).render('1-redirect.hbs',{
        message: e,
        token: req.params.token,
        page: 'Add people',
        timer: 6,
        token: req.session.token
      })
    })
  }

  readXlsxFile(__dirname+'/static/sample.xlsx').then((rows) => {
    // console.log(rows[0]);
    res.render('1-addpeople.hbs',{
      addpeople: 'active',
      sampleRows: rows[0],
      token: req.query.token,
      name: req.session.name,
      due: req.session.due && req.session.due.length,
    });
  }).catch((e) => {
    console.log(e);
    res.status(400).render('1-redirect.hbs',{
      message: e,
      token: req.params.token,
      page: 'Add people',
      timer: 6,
      token: req.session.token
    })
  })

});

app.get('/addOnePerson', authenticate, (req,res) => {
  return res.status(200).render('1-updateperson.hbs',{call: 'Add 1 Person'});
})

app.get('/updateperson', authenticate, (req,res) => {

  console.log(req.query);

  People.findOne({_id:req.query.id, addedBy: req.params.user._id}).lean().then(msg => {
    if (!msg) return Promise.reject('This person was not added by you. You can update only people added by you !');
    let options = {
      data: msg,
      name: req.params.user.name,
      token: req.query.token,
      due: req.session.due,
      currency: req.session.hasOwnProperty('browserCurrency'),
    }
    if (req.headers.accept == process.env.test_call) return res.status(200).send(options);
    return res.status(200).render('1-updateperson.hbs',options);
  }).catch(e => {
    res.status(400).render('1-redirect.hbs',{
      message: e,
      token: req.params.token,
      page: 'Update Person',
      timer: 6,
      token: req.session.token
    })
  })
});

app.get('/due',authenticate,(req,res) => {

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
        localCurrency: req.session.browserCurrency.currency_code,
        publishableKey: process.env.stripePublishableKey

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
    let objectIdArray = paymentDetails.map(s => mongoose.Types.ObjectId(s.id));
    People.aggregate([
      {   $match: {"_id": { $in: objectIdArray }} },
      {   $addFields: { addedBy: { $toObjectId: "$addedBy" } } },
      {   $lookup: {
            from: 'users',
            localField: "addedBy",
            foreignField: "_id",
            as: "users"
          }
      },
      {   $project: {
              status: "$cardClass",
              name: 1,
              address: 1,
              mob: 1,
              sponsorName: {$arrayElemAt: ["$users.name", 0] },
              sponsorAddress: {$arrayElemAt: ["$users.sponsorAddress", 0] },
              sponsorMob: {$arrayElemAt: ["$users.mob", 0] },
              paidby: req.params.user._id.toString(),
              paidto: "$_id",
        }
      }
    ]).then((msg) => {
      req.people = msg.map(val => {
        let amount = paymentDetails.find(value => {
          return value.id == val._id.toString();
        }).amount;
        return {...val,...{
          amount_text: `${amount} ${req.session.browserCurrency.currency_code}`,
          amount: amount
        } };
      })

      let array = req.people.map(val => {
        return {
          paidby: val.paidby,
          paidto: val.paidto,
          amount: val.amount,
          status: 'in progress',
          currency: req.session.browserCurrency.currency_code,
          customer: req.charge.customer,
          receipt: req.charge.receipt_url
        }
      });

      // console.log(req.people);
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
  console.log('making stripe request');
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

app.post('/updateOneinExcel', authenticate, (req,res) => {
  console.log(req.body);
  People.updateOne({_id: req.body.id}, {
    $set: {
      name: req.body.name,
      mob: req.body.mob,
      occupation: req.body.occupation,
      salary: req.body.salary,
      fMembers: req.body.fMembers,
      story: req.body.story,
      address: req.body.address
    }
  }, {upsert: true}).then(msg => {
    console.log(msg);
    res.status(200).send(msg);
  }).catch(e => {
    console.log(e);
    res.status(400).send(e);
  })
})

app.post('/excelData', authenticate, (req,res) => {
  var body = [];
  _.each(req.body,(val,key)=> {
    val.addedBy = req.params.user._id.toString();
    val.cardClass = 'pending';
    val.sponsorName = req.params.user.name;
    val.sponsorMob = req.params.user.mob;
    val.sponsorAccountTitle = req.params.user.accountTitle;
    val.sponsorAccountNo = req.params.user.accountNo;
    val.sponsorAccountIBAN = req.params.user.IBAN;
    body[key] = _.pick(val,['name','mob','occupation','salary','fMembers','story','address','addedBy','sponsorName','sponsorMob','sponsorAccountTitle','sponsorAccountNo','sponsorAccountIBAN']);
    // Name	Mobile No	Earning per month	Occupation	Currency	Family Members	Address	Story
  });

  var bulk = People.collection.initializeUnorderedBulkOp();
  _.each(req.body, (val,key) => {
    bulk.find( { mob: val.mob } ).upsert().update( { $set: val } )
  })

  bulk.execute().then((msg) => {
    console.log(msg);
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
    console.log({sponsored: msg[0][0], paid: msg[1][0]});
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
        "username": req.body.username
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



app.get('/donate/:id',(req,res,next) => {
  req.match = {_id: mongoose.Types.ObjectId(req.params.id)};
  getBasicData(req).then(person => {
    if (!person) return Promise.reject('Sorry. The link has been resolved. Redirecting you to home page.')
    if (!req.session.due) req.session.due = [req.params.id];
    else req.session.due.push(req.params.id);
    return res.status(200).set('Test',req.session.due).render('1-getPersonDonation',{
      data: person[0].people[0],
      due: req.session.due,
      exchangeRate: person[0].exchangeRate,
      token: req.session.token
    });
  }).catch(e => res.status(400).render( '1-redirect.hbs' , {
    timer: 10,
    page: 'Link resolved',
    message: e
  }))


})

app.get('/quranDaily', (req,res) => {

  readXlsxFile(__dirname+'/static/1.quranDaily.xlsx').then((rows) => {
    let sorted = rows.map((val) =>
      val.reduce((total,inner,index) => {

        if (inner) Object.assign(total,{
          [rows[0][index]]: inner
        })
        return total;
      },{})
    ).filter((val,index) => index != 0);

    sorted = sorted.map(val => {
      if (!val.Content) return;
      val.Content = val.Content.split('\r\n').map(val => {
        console.log(val, val.split(': ')[0].indexOf('.'));
        return {
          type: val.split(': ')[0].indexOf('.') != -1 ? val.split(': ')[0].split('.')[0] : val.split(': ')[0],
          msg: val.split(': ')[1].trim(),
          class: val.split(': ')[0].indexOf('.') != -1 ? val.split(': ')[0].split('.')[1] : ''
        }
      });
      return val;
    })
    let days = [];
    for (var i = 1; i <= sorted.length; i++) {
      // console.log(sorted[0]);
      days.push({
        index: i,
        data: sorted[i-1] != undefined ? 'active' : 'inactive'
      })
    };

    console.log(sorted);

    res.status(200).render('1-qurandaily.hbs', {
      data: sorted,
      days
    });
  })
})

app.get('/blogpost', (req,res) => {
  readXlsxFile(__dirname+'/static/1.quranDaily.xlsx').then((rows) => {
    let sorted = rows.map((val) =>
      val.reduce((total,inner,index) => {

        if (inner) Object.assign(total,{
          [rows[0][index]]: inner
        })
        return total;
      },{})
    ).filter((val,index) => index != 0 && val.Ser == req.query.serialNo);

    sorted = sorted.map(val => {
      if (!val.Content) return;
      val.Content = val.Content.split('\r\n').map(val => {
        console.log(val);
        return {
          type: val.split(': ')[0].indexOf('.') != -1 ? val.split(': ')[0].split('.')[0] : val.split(': ')[0],
          msg: val.split(': ')[1].trim(),
          class: val.split(': ')[0].indexOf('.') != -1 ? val.split(': ')[0].split('.').slice(1,4).join(' ') : ''
        }
      });
      val.Date = val.Date.toString().split(' ').slice(1,4).join('-')
      return val;
    })

    console.log(JSON.stringify(sorted, 0, 2));
    res.render('1-blogpost.hbs',{
      data: sorted[0],
      tags: sorted[0].Tags.split(',')
    });
  })
})

hbs.registerHelper('match', function(val1,val2) {
  // console.log(val1,val2);
  return val1.toUpperCase() == val2.toUpperCase() ? true : false;
})



app.get('/ticket',(req,res) => {
  res.status(200).render('raiseticket.hbs');
})

hbs.registerHelper("ifTopic",function (data, compareTo) {
  console.log(data,compareTo);
  return Object.keys(data).some(key => key == compareTo);
})

hbs.registerHelper("matchValues", function(page, val) {
  try {
    if (page == val) return true;
    let object = page[Object.keys(page)[0]].split(',').reduce((total,value) => {
      Object.assign(total,{
        [value.split('- ')[0].trim()]: value.split('- ')[1].trim()
      });
      return total;
    },{})
    // console.log({val,value: object[val], length: object[val].length});
    if (object[val].length > 0) return true;
    return false;
  } catch (e) {
    return false;
  }
})

hbs.registerHelper("checkValueExists", function(data, position) {
  try {
    let value = Object.keys(data)[0];
    return data[value].split(',')[position].split('- ')[1].length > 0
  }
  catch(e) {
    return false;
  }

})

hbs.registerHelper("getObjectValue", (data,position) => {
  // console.log(data);
  for (var key in data) {
    if (data.hasOwnProperty(key)) {
      return data[key].split(',')[position].split('- ')[1];
    }
  }
})

hbs.registerHelper("getTopicsListed", (data, key) => {
  return data[key].split(',').reduce((total,val) => {
    if (val.indexOf('Chapter') != -1) return total += `<li class="section">${val}</li>`;
    return total += `<li>${val}</li>`;
  },'');
})

hbs.registerHelper("getObjectUsingKey", (data, key) => {
  // let value = Object.keys(data)[0];
  let object = data[Object.keys(data)[0]].split(',').reduce((total,value) => {
    Object.assign(total,{
      [value.split('- ')[0].trim()]: value.split('- ')[1].trim()
    });
    return total;
  },{});
  return object[key];
})

app.get('/school',(req,res) => {

  // console.log('herere', req.query);

  // if paid the price then let him use the app

  req.query.pagerequest = req.query.pagerequest || 'ATOC';

  let dateToday = moment().format('YYYY-MM-DD');

  readXlsxFile(__dirname+'/static/life.xlsx').then((rows) => {
    let sorted = rows.map((val) =>
      val.reduce((total,inner,index) => {

        if (inner) Object.assign(total,{
          [rows[0][index]]: inner
        })
        return total;
      },{})
    ).filter((val,index) => index != 0);

    sorted.map(val => {
      Object.keys(val).forEach(key => {
        if (key == 'Date') return;
        let arr = val[key].replace('/\r/\n','').trim().split(';');
        let values = arr.reduce((total,nVal) => {
          if (!nVal) return total;
          total.push(
            {[nVal.split(': ')[0].replace('\r\n','')]: nVal.split(': ')[1].trim()}
          );
          return total;
        },[])
        val[key] = values;
      });
      return val;
    });

    let courses = Object.keys(sorted[0]);
    courses = courses.map((val,key) => {
      return {
        course: val,
        name: sorted[0][val][0].Subject,
        active: req.query.pagerequest && req.query.pagerequest.toUpperCase() == val,
        index: key
      }
    }).filter((val,key) => key != 0).sort((a,b) => b.index - a.index);

    let askedPage = req.query.pagerequest && req.query.pagerequest.toUpperCase() || 'ATOC';

    sorted = sorted.map((val,index) => {
      return val[askedPage.toUpperCase()];
    })

    console.log(courses);

    sorted[0] = {
      Subject: sorted[0][0].Subject,
      Instructor: sorted[0][1].Instructor,
      ClassSenior: sorted[0][2].ClassSenior,
      Note: sorted[0][3].Note,
      CreditHours: sorted[0][4].CreditHours,
    }

    console.log(askedPage.toUpperCase());

    res.render('abasyn.hbs',{
        sorted,
        [askedPage.toLowerCase()]: 'active',
        pagerequest: askedPage.toUpperCase(),
        token: '123',
        courses: courses
      });
  });

});

app.get('/signinschool',(req,res) => {
  readXlsxFile(__dirname+'/static/users.xlsx').then((rows) => {
    let sorted = rows.map((val) =>
      val.reduce((total,inner,index) => {

        if (inner) Object.assign(total,{
          [rows[0][index]]: inner
        })
        return total;
      },{})
    ).filter((val,index) => index != 0 && val.email == req.query.email && val.password == req.query.password);

    if (sorted.length > 0) res.status(200).send(sorted);
    else res.status(400).send(sorted);
  })
})


app.get('/:username',(req,res, next) => {
  Users.findOne({username: req.params.username}).then(result => {

    if (!result) return Promise.reject(`Invalid url: zakatlists.com/${req.params.username}, Redirecting you to home page.`);

    id = result._id.toString() + ',';

    req.url = `/`;
    req.query = {
      user: id,
      showQty: 12,
      expression: 'delivered|pending|inprogress'
    };
    app._router.handle(req, res, next);
  }).catch(e => {
    console.log(e);
    return res.render( '1-redirect.hbs' , {
      timer: 10,
      page: 'No Sponsor Found',
      message: e
    });
  })
})

serverRunning();


module.exports = {app,http,mongoose,People,Orders,CurrencyRates,Users};
