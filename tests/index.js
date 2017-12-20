/* Unit tests. */
/* jshint mocha: true */
'use strict';

const request = require('supertest'),
      assert = require('chai').assert,
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

describe('Edit', function() {
    it('Should provide a form', function() {
        return request(app).get('/edit')
            .expect('Content-Type', 'text/html')
            .expect(200)
            .then(response => {
                const { document } = (new JSDOM(response.text)).window;
                assert.equal(document.querySelectorAll(".component").length, 3);
            });
    });
});
