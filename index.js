require('./config/config');

const http = require('http');
const reload = require('reload');
const express = require('express');
const pjax    = require('express-pjax');
const bodyParser = require('body-parser');
const hbs = require('hbs');
const _ = require('lodash');
const readXlsxFile = require('read-excel-file/node');
const axios = require('axios');
const {OAuth2Client} = require('google-auth-library');
const session = require('express-session');
var ip = require("ip");
const publicIp = require('public-ip');
const stripe = require('stripe')('sk_test_hysfFVSPpr2vUx2kbqXMNHOJ');

const {sheet} = require('./server/sheets.js');
const {mongoose} = require('./db/mongoose');
const {People} = require('./models/people');
const {Orders} = require('./models/orders');
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
app.use(session({
  secret: 'oasdfkljh2j3lgh123ljkhl12kjh3',
  resave: false,
  saveUninitialized: true,
}))
hbs.registerPartials(__dirname + '/views/partials');
app.set('view engine','hbs');

hbs.registerHelper("inc", function(value, options)
{
    return parseInt(value) + 1;
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
  People.find({addedBy: req.params.user._id}).then((sponsored) => {
    // get all orders placed by me
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
      val.amount = stuff.amount + ' ' + stuff.currency.toUpperCase();
      val.status = stuff.status.toUpperCase();
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
    res.status(400).send(e);
  });
});

app.get('/',(req,res) => {

  if (!req.session.due) req.session.due = [];

  People.find().limit(12).then((msg) => {
    res.data = msg;
    return readXlsxFile(__dirname+'/static/sample.xlsx')
  }).then((rows) => {
    req.session.sampleRows = rows[0];
    res.render('1-home.hbs', {
      data: res.data,
      sampleRows: rows[0],
      due: req.session.due.length,
      dueIds: req.session.due,
    });
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
  })
});


app.get('/zakatcalc',(req,res) => {

  res.render('1-zakatcalc.hbs',{
    zakatcalc: 'active',
    token: req.session.token,
    name: req.session.name,
    due: req.session.due.length,
  });

})

app.get('/signin/:call',(req,res) => {
  console.log(req.params.call);
  let options = {};
  if (req.params.call != 'home') {
    options = {
      signin: 'active',
      call: `${req.params.call}`,
      due: req.session.due.length,
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
    due: req.session.due.length,
  });
});

app.get('/addpeople/:token',authenticate,(req,res) => {

  readXlsxFile(__dirname+'/static/sample.xlsx').then((rows) => {
    res.render('1-addpeople.hbs',{
      addpeople: 'active',
      sampleRows: rows[0],
      token: req.session.token,
      name: req.session.name,
      due: req.session.due.length,
    });
  }).catch((e) => {
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

var getip = (req) => {
  return new Promise(function(resolve, reject) {
    console.log(process.env.PORT);
    if (process.env.PORT == '3000') return resolve(publicIp.v4());
    resolve(req.connection.remoteAddress);
    });
};

// app.get('/due',(req,res)=> {
//   res.render('1-due.hbs',{
//
//   });
// })

app.get('/due/:token',authenticate,(req,res) => {

  let objectIdArray = req.session.due.map(s => mongoose.Types.ObjectId(s));
  try {
    getip(req).then((res) => {
      return axios.get(`http://www.geoplugin.net/json.gp?ip=${res}`);
    }).then((result) => {
      req.currency = `${result.data.geoplugin_currencyCode.toUpperCase()}`;
      return People.find({'_id' : {$in : objectIdArray}});
    }).then((msg) => {
      console.log(msg[0].currency);
      res.render('1-due.hbs',{
        people: msg,
        dueStatus: 'active',
        due: req.session.due.length,
        token: req.session.token,
        name: req.session.name,
        email: req.params.user.email,
        localCurrency: req.currency
      });
    });
  }
  catch(error) {
    console.log(error);
    res.render('1-redirect.hbs',{
      message: `Due to an error: [${error}], Redirecting to home page.`,
      token: req.params.token,
    })
  };

});

function updateOrders(req,res) {
  // if (!req.session.token) return res.status(400).send('Un auhtorized request');
  return new Promise(function(resolve, reject) {
    let paymentDetails = JSON.parse(req.query.paymentDetails);
    let objectIdArray = paymentDetails.map(s => mongoose.Types.ObjectId(s.id));
    People.find({'_id' : {$in : objectIdArray}}).then((msg) => {
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
                            return obj.id === val._id.toString();
                        })[0].amount;
        values.status = 'pending';
        values.currency = req.currency;
        values.customer = req.charge.customer;
        array.push(values);
      });
      return Orders.create(array);
    }).then((order) => {
      return resolve(order);
    }).catch((e) => {
      return reject(e);
    });
  });

}

app.get("/charge", authenticate, (req, res) => {

  // console.log(req.query);

  getip(req).then((res) => {
    return axios.get(`http://www.geoplugin.net/json.gp?ip=${res}`);
  }).then((result) => {
    req.currency = `${result.data.geoplugin_currencyCode.toLowerCase()}`;
    return stripe.products.create({
      name: 'T-shirt',
      type: 'good',
      description: 'Comfortable cotton t-shirt',
      attributes: ['size', 'gender']
    })
  }).then((msg) => {
    return stripe.customers.create({
      email: req.query.email,
      card: req.query.stripeToken
    });
  }).then(customer =>
     stripe.charges.create({
      amount: req.query.amount,
      description: "Sample Charge",
      currency: req.currency,
      customer: customer.id
  })).then((charge) => {
    req.charge = charge;
    return updateOrders(req,res);
  }).then((msg) => {
    // msg.push(req.charge);
    // return res.status(200).send(msg);
    req.session.due = [];
    res.render('1-charge.hbs',{
      dueStatus: 'active',
      due: req.session.due.length,
      token: req.session.token,
      name: req.session.name,
      receipt: req.charge.receipt_url,
      payed: req.people
    });
  }).catch(err => {
    console.log("Error:", err);
    // return res.status(400).send(err);
    res.status(500).send({error: err});
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

  console.log(req.params.user.name,'entered home');

  // LIST ALL PEOPLE
  People.find().limit(12).then((msg) => {
    req.data = msg;
    // FIND PEOPLE PAID ZAKAT BY ME
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
      if (val.addedbyme || val.paidbyme.length > 0) val.unlocked = true;
    });
    // console.log(req.data);
    res.render('1-home.hbs',{
      data: req.data,
      sampleRows: rows[0],
      token: req.session.token,
      name: req.params.user.name,
      due: req.session.due.length,
      dueIds: req.session.due,
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
    req.url = '/';
    return app._router.handle(req, res);
  }).catch((e) => {
    console.log(e);
    res.status(404).send(e);
  });
});

app.get('/explore',(req,res) => {
  res.renderPjax('testing.hbs', { name: 'Hashim' });
})

app.post('/signing',(req,res) => {

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
    var user = new Users(
      _.pick(req.body,['name','email','password']),
    );
    user.generateAuthToken(req).then((returned) => {
      res.status(200).send(returned.tokens[0].token);
      return console.log('saved', returned.name);
    }).catch((e) => {
      console.log(e);
      if (e.code === 11000) return res.status(400).send('You are already registered with this email. Please Sign in.');
      console.log('Error here', e);
      return res.status(400).send('Server - Bad Request');
    });
  };

  if (req.body.query === 'Google_ID') {

    req.body.SigninType = 'Google';
    const client = new OAuth2Client('133536550317-q6m1gun90s198i2un77l91d9qsv9cck6.apps.googleusercontent.com');
    client.verifyIdToken({
        idToken: req.body.id_token,
        audience: '133536550317-q6m1gun90s198i2un77l91d9qsv9cck6.apps.googleusercontent.com',
    }).then((ticket) => {
        const payload = ticket.getPayload();
        const userid = payload['sub'];
        return Users.findOneAndUpdate({"email": req.body.email}, {$set : {"SigninType":req.body.SigninType}}, {new: true});
    }).then((returned) => {
        if (!returned) return Promise.reject('Invalid Request');
        return returned.generateAuthToken(req);
    }).then((returned) => {
        res.status(200).send(returned.tokens[0].token);
        return console.log('saved', returned.name);
    }).catch((e) => {
        console.log(e);
        if (e.code === 11000) return res.status(400).send('You are already registered with this email. Please Sign in.');
        console.log('Error here', e);
        return res.status(400).send('Server - Bad Request' + e);
    });

  };

  if (req.body.query === 'GoogleIn') {
    req.body.SigninType = 'Google';
    Users.findOneAndUpdate({"email": req.body.email}, {$set : {"SigninType":req.body.SigninType}}, {new: true}).then((returned) => {
      if (!returned) return Promise.reject('Invalid Request');
      return returned.generateAuthToken(req);
    }).then((returned) => {
      res.status(200).send(returned.tokens[0].token);
      return console.log('saved', returned.name);
    }).catch((e) => {
      console.log(e);
      if (e.code === 11000) return res.status(400).send('You are already registered with this email. Please Sign in.');
      console.log('Error here', e);
      return res.status(400).send('Server - Bad Request' + e);
    });
  }

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
app.set('port', process.env.PORT || 3000);
var server = http.createServer(app)
// Reload code here
reload(app).then(function (reloadReturned) {
  // reloadReturned is documented in the returns API in the README
  // Reload started, start web server
  server.listen(app.get('port'), function () {
    console.log('Web server listening on port ' + app.get('port'))
  })
}).catch(function (err) {
  console.error('Reload could not start, could not start server/sample app', err)
});
