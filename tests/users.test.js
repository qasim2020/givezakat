require('../config/config');

const express = require('express');
const request = require('supertest');
const {app} = require('../app.js');

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

test('Should create a new user by google', (done) => {
  request(app)
    .get('/')
})
