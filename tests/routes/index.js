/* Unit tests. */
/* jshint mocha: true */
'use strict';

const request = require('supertest'),
      assert = require('chai').assert,
      jsdom = require('jsdom'),
      { JSDOM } = jsdom,
      app = require('../../lib/app'),
      { loadPageWithScripts } = require('../res');

describe('Index', function() {
    it('Should provide a page', function() {
        return request(app).get('/')
            .expect('Content-Type', 'text/html')
            .expect(200);
    });

    it('Should perform an update check', function(done) {
        request(app).get('/')
            .then(response => {
                loadPageWithScripts(app, response, done).then(window => {
                    const { document } = window;
                    window.$(document).ready(() => {
                        document.querySelector("#version button.update").click();
                        assert.equal(document.querySelector("#version button.update"), null);
                        done();
                    });
                }).catch((err) => {
                    done(err);
                });
            }).catch((err) => {
                done(err);
            });
    });
});
