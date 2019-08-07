require('../config/config');

const express = require('express');
const request = require('supertest');
const {app,mongoose,People,Orders,CurrencyRates,Users} = require('../app.js');

beforeEach(() => {
  return Users.find().deleteMany();
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
              console.log(res.body);
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
            .expect((res) => {
              console.log(res.text);
              // expect(res._id).toBe(stored_google);
            })
            .expect(200)
    await request(app)
            .post('/signing')
            .set('Accept',process.env.test_call)
            .send({
              query: 'new_password',
              email: 'qasimali24@gmail.com',
              password: '12341234qasim',
              code: phoneCode
            })
            .expect((res) => {
              expect(res._id).toBe(stored_google);
            })
            .expect(200)
  });

  test('Should not register an email that has already been created manually', async() => {
    await request(app)
            .post('/signing')
            .set('Accept',process.env.test_call)
            .send({
              query: 'Register',
              name: 'Qasim',
              email: 'qasimali24@gmail.com',
              password: '1234qasim'
            })
            .expect((res) => {
              expect(res.text.length).toBe(171);
            })
            .expect(200);
    await request(app)
            .post('/signing')
            .set('Accept',process.env.test_call)
            .send({
              query: 'Register',
              name: 'hacker',
              email: 'qasimali24@gmail.com',
              password: '12345qasim'
            })
            .expect(401);
  })

  test('Should register manually and then log in manually', async() => {
    await request(app)
            .post('/signing')
            .set('Accept',process.env.test_call)
            .send({
              query: 'Register',
              name: 'Qasim',
              email: 'qasimali24@gmail.com',
              password: '1234qasim'
            })
            .expect((res) => {
              expect(res.text.length).toBe(171);
            })
            .expect(200)
    await request(app)
            .post('/signing')
            .set('Accept',process.env.test_call)
            .send({
              "query": 'Login',
              "email": 'qasimali24@gmail.com',
              "password": '1234qasim'
            })
            .expect(res => {
              expect(res.text.length).toBe(171);
            })
            .expect(200)
  });

  test('Should register manually and then log in with google' , async() => {
    await request(app)
            .post('/signing')
            .set('Accept',process.env.test_call)
            .send({
              query: 'Register',
              name: 'Qasim',
              email: 'qasimali24@gmail.com',
              password: '1234qasim'
            })
            .expect((res) => {
              expect(res.text.length).toBe(171);
            })
            .expect(200)
    await request(app)
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
            .expect(200)
  });
})
