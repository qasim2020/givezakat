require('./config/config');

const express = require('express');
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
const {Users} = require('./models/users');
const {sendmail} = require('./js/sendmail');
const {serverRunning} = require('./js/serverRunning');
const {Subscription} = require('./models/subscription');

var app = express();
var port = process.env.PORT || 3000;
app.use(express.static(__dirname+'/static'));
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
app.use(session({
  secret: 'oasdfkljh2j3lgh123ljkhl12kjh3',
  resave: false,
  saveUninitialized: true
}))
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
    return res.status(404).render('1-home.hbs', {
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

  People.find().limit(12).then((msg) => {
    res.data = msg;
    return readXlsxFile(__dirname+'/static/sample.xlsx')
  }).then((rows) => {
    req.session.sampleRows = rows[0];
    res.render('1-home.hbs',{
      data: res.data,
      sampleRows: rows[0],
      token: req.session.token,
      name: req.session.name
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
    name: req.session.name
  });

  // res.render('signup.hbs');
})

app.get('/signin/:call',(req,res) => {
  console.log(req.params.call);
  let options = {};
  if (req.params.call != 'home') {
    console.log('here i am');
    options = {
      signin: 'active',
      call: `${req.params.call}`
    };
  } else {
    options = {signin: 'active'};
  };
  console.log(options);
  res.render('1-signin.hbs', options);
})

app.get('/signup',(req,res) => {
  res.render('1-signup.hbs',{
    signin: 'active'
  });
})

app.get('/forgotpw',(req,res) => {
  res.render('1-fp.hbs',{
    signin: 'active'
  });
});

app.get('/addpeople/:token',authenticate,(req,res) => {

  readXlsxFile(__dirname+'/static/sample.xlsx').then((rows) => {
    res.render('1-addpeople.hbs',{
      addpeople: 'active',
      sampleRows: rows[0],
      token: req.session.token,
      name: req.session.name
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
    // cart: 'active',
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

app.get('/cart/:token',authenticate,(req,res) => {

  res.render('1-cart.hbs',{
    cart: 'active',
    token: req.session.token,
    name: req.session.name
  });
});

app.get('/charge',(req,res) => {
  res.render('1-charge.hbs',{
    cart: 'active',
    token: req.session.token,
    name: req.session.name
  })
})

app.get('/checkoutURL',(req,res) => {

  getip(req).then((res) => {
    return axios.get(`http://www.geoplugin.net/json.gp?ip=${res}`);
  }).then((result) => {
    console.log(result);
    return stripe.checkout.sessions.create({
        customer_email: 'qasimali24@gmail.com',
        payment_method_types: ['card'],
        line_items: [{
          name: 'zakat',
          description: 'Amount is disbursed every 1st of a month.',
          images: ['https://zakatlists.com/logo5.png'],
          amount: 15000,
          currency: `${result.data.geoplugin_currencyCode.toLowerCase()}`,
          quantity: 1,
        }],
        success_url: 'http://localhost:3000/cart',
        cancel_url: 'http://localhost:3000/cart',
      });
  }).then((result) => {
    res.status(200).send(result);
  }).catch((e) => {
    console.log(e);
    res.status(400).send(e);
  });

  // axios.post('https://vendors.paddle.com/api/2.0/product/generate_pay_link', {
  //   vendor_id: '52029',
  //   vendor_auth_code: '897b6543544f54c8e0c6d120796b0e8233c055a8fb1a8c70c9',
  //   product_id: '564500',
  //   prices: ['USD:105'],
  // })
  // .then((result) => {
  //   console.log(`statusCode: ${result.statusCode}`)
  //   console.log(result.data.response.url);
  //   console.log(result);
  // })
  // .catch((error) => {
  //   console.error(error)
  // })

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

  console.log(req.params.user.name,'entered home');

  People.find().limit(12).then((msg) => {
    res.data = msg;
    _.each(res.data,(val,key) => {
      if (val.addedBy == req.params.user.id) {
        return res.data[key]['mylist'] = true;
      }
      res.data[key]['mylist'] = false;
    });
    console.log(res.data[0]);
    return readXlsxFile(__dirname+'/static/sample.xlsx')
  }).then((rows) => {
    res.render('1-home.hbs',{
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
    req.session.destroy();
    return People.find().limit(12)
  }).then((msg) => {
    res.data = msg;
    return readXlsxFile(__dirname+'/static/sample.xlsx')
  }).then((rows) => {
    res.render('1-home.hbs',{
      data: res.data,
      sampleRows: rows[0]
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
    Users.findByToken(req.body.token).then((user) => {
      console.log(req.body.id, user._id);
      return People.deleteOne({_id:req.body.id, addedBy: user._id});
    }).then((person) => {
      if (!person) return Promise.reject('Unauthorized Request');
      res.status(200).send(person);
    }).catch((e) => {
      console.log(e);
      res.status(400).send(e)
    });
  }

});

serverRunning();

app.listen(port, () => {
  console.log(`listening on port ${port}...`);
});
