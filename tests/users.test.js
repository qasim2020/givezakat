require('../config/config');

const express = require('express');
const request = require('supertest');
const {app,mongoose,People,Orders,CurrencyRates,Users} = require('../app.js');

beforeEach(() => {
  let user = new Users({
      wrongAttempts: 0,
      attemptedTime: 0,
      _id: mongoose.Types.ObjectId('5d4c207f9e028a3d6a373f65'),
      email: 'register@gmail.com',
      // SigninType: 'manual',
      // __v: 1,
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
});

describe('Open all pages just fine', () => {
  test('Should open home page with basic data', (done) => {
    request(app)
      .get('/')
      .set('Accept', `${process.env.test_call}`)
      .expect((res) => {
        expect(res.body.sampleRows.length).toBe(9);
        expect(res.body.due).toBe(0);
        expect(res.body).toHaveProperty('dueIds');
        expect(res.body.currency).toBeFalsy();
        expect(res.body).toHaveProperty('count');
      })
      .expect(200, done)
  });
})

describe('Sign In related tests', () => {

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
              console.log('stage 1');
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
              console.log('stage 2');
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
              console.log('stage 4');
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
