/* Unit tests. */
/* jshint mocha: true */
'use strict';

const request = require('supertest'),
      jsdom = require('jsdom'),
      { JSDOM } = jsdom,
      app = require('../lib/app');

describe('Index', function() {
    it('Should provide a page', function(done) {
        request(app).get('/')
            .expect('Content-Type', 'text/html')
            .expect(200, done);
    });
});
