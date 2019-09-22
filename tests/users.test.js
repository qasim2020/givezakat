require('../config/config');

const express = require('express');
const request = require('supertest');
const session = require('supertest-session');
const _ = require('lodash');
const {app,mongoose,People,Orders,CurrencyRates,Users,axios} = require('../app.js');
const {zeroiseDB} = require('./zeroiseDB');
const {getStripeToken} = require('./getStripeToken');

describe('Open pages just fine', () => {

  var currencySession = session(app);

  test('Should put people in due ids', async() => {
    await zeroiseDB();
    await currencySession.post('/signing').set('Accept',`${process.env.test_call}`).send({
      query: 'update-due',
      type: 'push',
      due: "5d477e1b006cfdef99932bbe",
    }).expect(200)
  })

  test('Should open home page with basic data', async () => {
    await currencySession.get('/')
      .set('Accept', `${process.env.test_call}`)
      .expect((res) => {
        let sum = 0;
        _.each(res.body.count.Sponsors,(val,key) => {
          expect(val.sponsored).not.toBe();
          sum = sum + val.sponsored;;
        })
        expect(res.body.data[0].dueIds).toContain('card-selected');
        expect(res.body.data.length).toBe(12);
        expect(res.body.due).toBe(1);
        expect(res.body.currency).toBeFalsy();
        expect(res.body.count.Total).toBe(sum);
        expect(res.body.count.pending).toBe(10);
        expect(res.body.count.delivered).toBe(2);
        expect(res.body.count.inprogress).toBe(2);
      })
      .expect(200)
  })

  test('Should create currency session', async() => {
    await currencySession
      .post('/signing')
      .set('Accept', `${process.env.test_call}`)
      .send({
          query : "create-currency-session",
          msg: 'NOK',
        })
      .expect(200)
  })

  test('Should add select a person to session and log in with google',async() => {
    await currencySession.post('/signing').set('Accept',`${process.env.test_call}`).send({
      query: 'update-due',
      type: 'push',
      due: "5d477e1b006cfdef99932bbe",
    }).expect(200);
    await currencySession.post('/signing').set('Accept',`${process.env.test_call}`).send({
      'query': 'Google_ID',
      "name": 'registeredName',
      "email": 'register@gmail.com'
    }).expect(res => {
      expect(res.text.length).toBe(171);
      currencySession.token = res.text;
    }).expect(200);
  })

  test('Should open home page after conversion to local currency', async () => {
    await currencySession.get('/')
      .set('Accept', `${process.env.test_call}`)
      .expect((res) => {
        expect(res.body).not.toBeNull();
        _.each(res.body.data, (val,key) => {
          expect(val.salary).toContain('NOK');
        })
      })
      .expect(200)
  })

  test('Should place an order successfully', async() => {
    jest.setTimeout(30000);
    let array = [];
    array.push(
    {
      id : '5d477e1b006cfdef99932bbe',
      amount: '99000'
    },
    {
      id: '5d477e1b006cfdef99932bc0',
      amount: '10000'
    }
    );
    peoplePaid = JSON.stringify(array);
    await currencySession
    .get(`/charge?email=register@gmail.com&token=${currencySession.token}&amount=${99000}&stripeToken=tok_visa&paymentDetails=${peoplePaid}`)
    .set('Accept',`${process.env.test_call}`)
    .expect(res => {
      expect(res.body.name).toBe('registeredName');
      expect(res.body.receipt).not.toBe();
      expect(res.body.payed[0]._id).toBe('5d477e1b006cfdef99932bbe');
    })
    .expect(200);
  })

  test('Should show people paid by me', async() => {
    await currencySession.get(`/home/${currencySession.token}`).set('Accept',`${process.env.test_call}`).expect(res => {
      expect(res.body.data.length).toBe(12);
      expect(res.body.due).toBe(0);
      _.each(res.body.data,(val,key) => {
        if (val.paidbyme) expect(val.unlocked).toBeTruthy();
        if (val.addedbyme) expect(val.unlocked).toBeTruthy();
        if (!val.addedbyme && !val.paidbyme) expect(val.unlocked).toBeFalsy();
      })
    }).expect(200);
  });

  test('Should get count of people paid and sponsored by me', async() => {
    await currencySession.get(`/getCount?token=${currencySession.token}`).set('Accept',`${process.env.test_call}`).expect(res => {
      console.log(res.text);
      expect(res).not.toBe();
    }).expect(200);
  })

  test('Should fetch pjax links fine', async() => {
    await currencySession.get(`/peopleBussinessCards?token=${currencySession.token}&type=all&showQty=12&expression=delivered|pending|inprogress`)
    .set('Accept',`${process.env.test_call}`)
    .expect(res => {
      expect(res.body.data.length).toBe(12);
      _.each(res.body.data,(val,key) => {
        if (val.paidbyme) expect(val.unlocked).toBeTruthy();
        if (val.addedbyme) expect(val.unlocked).toBeTruthy();
        if (!val.addedbyme && !val.paidbyme) expect(val.unlocked).toBeFalsy();
      })
    }).expect(200)
    await currencySession.get(`/peopleBussinessCards?token=${currencySession.token}&type=my&showQty=4&expression=delivered|pending|inprogress`)
    .set('Accept',`${process.env.test_call}`)
    .expect(res => {
      expect(res.body.addedbyme.length).toBe(4);
      expect(res.body.paidbyme.length).toBe(2);
    }).expect(200)
  })

})

describe('Sign In related tests', () => {

  beforeEach(() => {
    let user = new Users({
        wrongAttempts: 0,
        attemptedTime: 0,
        _id: mongoose.Types.ObjectId('5d4c207f9e028a3d6a373f65'),
        email: 'register@gmail.com',
        name: 'registeredName',
        tokens:
         [ { _id: mongoose.Types.ObjectId('5d4c207f4abfaf2ef2cc65f1'),
             access: 'auth',
             token:
              'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI1ZDRjMjA3ZjllMDI4YTNkNmEzNzNmNjUiLCJhY2Nlc3MiOiJhdXRoIiwiaWF0IjoxNTY1MjcwMTQzfQ.r-Ohc4zXwRTb7CtVGucjRe93XVmLmLpIW4frb6YyCcE' } ],
        phoneCode: '123456',
        password: 'aaksdjfhasfd'
      });
    return Users.find().deleteMany().then(() => {
      return user.save();
    });
  })

  test('Should manually sign up a user', async() => {
    let phoneCode;
    await request(app).post('/signing').set('Accept',process.env.test_call).send({
      query: 'Email_Verify',
      registerNew: true,
      email: 'qasimali24@gmail.com',
    })
    .expect((res) => {
      phoneCode = res.body.phoneCode;
    })
    .expect(200)
    await request(app).post('/signing').set('Accept',process.env.test_call).send({
      query: 'Test_Code',
      email: 'qasimali24@gmail.com',
      code: phoneCode,
    })
    .expect(200)
    await request(app).post('/signing').set('Accept',process.env.test_call).send({
      query: 'Register',
      email: 'qasimali24@gmail.com',
      password: '12341234qasim',
      phoneCode: phoneCode
    })
    .expect((res) => {
      expect(res.text.length).toBe(171);
    })
    .expect(200)
  })

  test('Should sign in with google', (done) => {
    request(app)
      .post('/signing')
      .set('Accept', process.env.test_call)
      .send({
        'query': 'Google_ID',
        "name": 'Qasim',
        "email": 'qasimali24@gmail.com',
      })
      .expect((res) => {
        expect(res.text.length).toBe(171);
      })
      .expect(200,done)
  });

  test('Google Sign in > Manual Register > Verify Email > Update Account', async () => {
    let stored_google, phoneCode;
    await request(app)
            .post('/signing')
            .set('Accept', process.env.test_call)
            .send({
              'query': 'Google_ID',
              "name": 'Qasim',
              "email": 'qasimali24@gmail.com',
            })
            .expect((res) => {
              stored_google = res._id
              expect(res.text.length).toBe(171);
            })
            .expect(200)
    await request(app)
            .post('/signing')
            .set('Accept',process.env.test_call)
            .send({
              query: 'Email_Verify',
              email: 'qasimali24@gmail.com',
            })
            .expect((res) => {
              phoneCode = res.body.phoneCode;
            })
            .expect(200)
    await request(app)
            .post('/signing')
            .set('Accept',process.env.test_call)
            .send({
              query: 'Test_Code',
              email: 'qasimali24@gmail.com',
              code: phoneCode,
            })
            .expect(200)
    await request(app)
            .post('/signing')
            .set('Accept',process.env.test_call)
            .send({
              query: 'Register',
              email: 'qasimali24@gmail.com',
              password: '12341234qasim',
              phoneCode: phoneCode
            })
            .expect((res) => {
              expect(res._id).toBe(stored_google);
            })
            .expect(200)
  });

  test('Should not register an email if it is not verified', async() => {
    await request(app).post('/signing').set('Accept',process.env.test_call).send({
      query: 'Register',
      email: 'qasimali24@gmail.com',
      password: '12341234qasim',
      phoneCode: ''
    }).expect(res => {
      // console.log(res.text);
    }).expect(401)
  })

  test('Should not register an email that has already been created manually', async() => {
    await request(app)
            .post('/signing')
            .set('Accept',process.env.test_call)
            .send({
              query: 'Register',
              name: 'fakeName',
              email: 'register@gmail.com',
              password: '123412341324',
              phoneCode: '123456'
            })
            .expect((res) => {
              // expect(res.text.length).toBe(171);
              // console.log('*****',res.text);
            })
            .expect(401);
  })

  test('Should log in manually', async() => {
    await request(app)
            .post('/signing')
            .set('Accept',process.env.test_call)
            .send({
              "query": 'Login',
              "email": 'register@gmail.com',
              "password": 'aaksdjfhasfd'
            })
            .expect(res => {
              expect(res.text.length).toBe(171);
            })
            .expect(200)
  });

  test('Should log in with google when already registered manually' , async() => {
    await request(app)
            .post('/signing')
            .set('Accept', process.env.test_call)
            .send({
              'query': 'Google_ID',
              "name": 'Hashim Ali',
              "email": 'register@gmail.com',
            })
            .expect((res) => {
              expect(res.text.length).toBe(171);
            })
            .expect(200)
  });
})
