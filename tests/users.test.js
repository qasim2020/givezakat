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
      .set('Accept', 'test_call')
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
      .set('Accept', 'test_call')
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

  test('Should sign in with google and then register as a new user', async () => {
    let stored_google;
    await request(app)
            .post('/signing')
            .set('Accept', 'test_call')
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
            .set('Accept','test_call')
            .send({
              query: 'Register',
              name: 'Qasim',
              email: 'qasimali24@gmail.com',
              password: '1234qasim'
            })
            .expect((res) => {
              expect(res._id).toBe(stored_google);
              expect(res.text.length).toBe(171);
            })
            .expect(200)
  });

  test('Should not register an email that has already been created manually', async() => {
    await request(app)
            .post('/signing')
            .set('Accept','test_call')
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
            .set('Accept','test_call')
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
            .set('Accept','test_call')
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
            .set('Accept','test_call')
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
            .set('Accept','test_call')
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
            .set('Accept', 'test_call')
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
