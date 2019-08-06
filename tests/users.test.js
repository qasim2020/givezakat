require('../config/config');

const express = require('express');
const request = require('supertest');
const {app} = require('../index.js');

test('Should open basic home page', (done) => {
  request(app)
    .get('/')
    .expect(200)
});
