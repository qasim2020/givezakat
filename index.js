require('./config/config');

const express = require('express');
const bodyParser = require('body-parser');
const hbs = require('hbs');
const _ = require('lodash');
const readXlsxFile = require('read-excel-file/node');
const axios = require('axios');

const {sheet} = require('./server/sheets.js');
const {mongoose} = require('./db/mongoose');
const {People} = require('./models/people');
const {Users} = require('./models/users');
const {sendmail} = require('./js/sendmail');
const {serverRunning} = require('./js/serverRunning');
const {Subscription} = require('./models/subscription');

var app = express();
var port = process.env.PORT || 3000;
app.use(express.static(__dirname+'/static'));
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
hbs.registerPartials(__dirname + '/views/partials');
app.set('view engine','hbs');

hbs.registerHelper("inc", function(value, options)
{
    return parseInt(value) + 1;
});

// sheet('construction','read');
// sheet('material','read');
// sheet('material','update',[
// [new Date().toString(),'MES','Sand','2000', 'cft','Brought it for const of Washroom']
// ]);
// sheet('ramadan','read').then((msg) => {
//   res.render('home.hbs',{
//     data: msg[0].values,
//   });
// }).catch((e) => {
//   console.log(e);
// });

let authenticate = (req,res,next) => {
  let token = req.params.token || req.body.token;
  console.log('token receiveed',token);
  Users.findByToken(token).then((user) => {
    if (!user) return Promise.reject('No user found');
    req.params.user = user;
    next();
  }).catch((e) => {
    console.log(e);
    return res.status(404).render('home.hbs', {
      error: 'Bad Request! Please use proper URL to open app.'
    });
  });
};


app.get('/hacks',(req,res) => {
  res.render('1-fp.hbs');
})

app.get('/',(req,res) => {
  console.log('home page opened.');

  // return res.render('hacks.hbs');

  People.find().then((msg) => {
    res.data = msg;
    return readXlsxFile(__dirname+'/static/sample.xlsx')
  }).then((rows) => {
    console.log(res.data);
    res.render('1-home.hbs',{
      data: res.data,
      sampleRows: rows[0]
    });
  }).catch((e) => {
    console.log(e);
    res.status(404).send(e);
  });
});


app.get('/zakatcalc',(req,res) => {
  res.render('1-zakatcalc.hbs',{
    zakatcalc: 'active',
  });
  // res.render('signup.hbs');
})

app.get('/signin',(req,res) => {
  res.render('1-signin.hbs',{
    signin: 'active',
  });
  // res.render('signup.hbs');
})

app.get('/signup',(req,res) => {
  res.render('1-signup.hbs',{
    signin: 'active'
  });
  // res.render('signup.hbs');
})

app.get('/forgotpw',(req,res) => {
  res.render('1-fp.hbs',{
    signin: 'active'
  });
});

app.get('/addpeople',(req,res) => {
  res.render('1-addpeople.hbs',{
    addpeople: 'active'
  });
});

app.get('/cart',(req,res) => {
  res.render('1-cart.hbs',{
    cart: 'active',
    // url: result.data.response.url,
  });
});

app.get('/checkoutURL',(req,res) => {
  axios.post('https://vendors.paddle.com/api/2.0/product/generate_pay_link', {
    vendor_id: '52029',
    vendor_auth_code: '897b6543544f54c8e0c6d120796b0e8233c055a8fb1a8c70c9',
    product_id: '564500',
    prices: ['USD:105'],
  })
  .then((result) => {
    console.log(`statusCode: ${result.statusCode}`)
    console.log(result.data.response.url);
    console.log(result);
  })
  .catch((error) => {
    console.error(error)
  })
})

app.post('/data',(req,res) => {

  if (req.body) {
    return res.status(200).send('data recieved');
  }
  res.status(400).send('sorry no data recieved');

});

app.post('/excelData',(req,res) => {
  var body = [];
  _.each(req.body,(val,key)=> {
    // val.addedBy = req.params.user._id.toString();
    body[key] = _.pick(val,['name','mob','salary','fMembers','story','address','sponsorName','sponsorMob','sponsorAccountTitle','sponsorAccountNo','sponsorAccountIBAN','package','packageCost','packageQty','orderDate','deliveryDate','pteInfo','nearestCSD','cardClass','addedBy']);
  });
  console.log(body);
  People.insertMany(body,{ordered:false}).then((msg) => {
    console.log(msg.length);
    res.status(200).send(`Successfully added <b>${msg.length} rows</b>.`);
  }).catch((e) => {
    let errors = [];
    // console.log(e.result.result);
    if (e.result.result) {
      errors.push(`Updated <b>${e.result.result.nInserted}</b> rows!`);
      errors.push(`Failed to update <b>${e.result.result.writeErrors.length}</b> rows due to duplicates:-`)
      _.each(e.result.result.writeErrors,(val,key) => {
        // console.log(val.err.op);
        errors.push(key + '. ' + val.err.op.name + ', ' + val.err.op.mob);
      })
      console.log(errors);
      return res.status(400).send(errors);
    }
    res.status(400).send(e);

  });

});

app.get('/home/:token', authenticate, (req,res) => {

  console.log(req.params.user.name,'entered home');

  People.find().then((msg) => {
    res.data = msg;
    return readXlsxFile(__dirname+'/static/sample.xlsx')
  }).then((rows) => {
    console.log(res.data);
    res.render('home.hbs',{
      data: res.data,
      sampleRows: rows[0],
      token: req.params.token,
      name: req.params.user.name,
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
    return People.find();
  }).then((msg) => {
    console.log(res.data);
    res.render('home.hbs',{
      data: msg,
    });
  }).catch((e) => {
    console.log(e);
    res.status(404).send(e);
  });
})

app.post('/signing',(req,res) => {

  if (req.body.query === 'Register') {
    var user = new Users(
      _.pick(req.body,['name','email','password']),
    );
    user.generateAuthToken().then((returned) => {
      res.status(200).send(returned.tokens[0].token);
      return console.log('saved', returned.name);
    }).catch((e) => {
      console.log(e);
      if (e.code === 11000) return res.status(400).send('You are already registered with this email. Please Sign in.');
      console.log('Error here', e);
      return res.status(400).send('Server - Bad Request');
    });
  };

  if (req.body.query === 'GoogleIn') {
    // var user = new Users(
    //   _.pick(req.body,['name','email']),
    // );
    req.body.SigninType = 'Google';
    Users.findOneAndUpdate({"email": req.body.email}, {$set : {"SigninType":req.body.SigninType}}, {new: true}).then((returned) => {
      if (!returned) return Promise.reject('Invalid Request');
      return returned.generateAuthToken();
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
      return returned.generateAuthToken();
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
      if (!user) return res.status(404).send('Un authorized request');
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
      return user.generateAuthToken();
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
      _.pick(req.body,['email'])
    );
    subscription.save().then((result) => {
      return res.status(200).send(result);
    }).catch((e) => {
      if (e.code === 11000) return res.status(400).send('You are already subscribed with this email.');
      res.status(400).send(e);
    });
  }

});

serverRunning();

app.listen(port, () => {
  console.log(`listening on port ${port}...`);
});
