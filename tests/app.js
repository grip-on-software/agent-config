/* Unit tests for the application. */
/* jshint mocha: true */
'use strict';

const request = require('supertest'),
      assert = require('chai').assert,
      jsdom = require('jsdom'),
      { JSDOM } = jsdom;

describe('Application', function() {
    var env, app;
    beforeEach(function() {
        env = process.env;
        process.env = {'NODE_ENV': 'dev-sync'};
        delete require.cache[require.resolve('../lib/app')];
        app = require('../lib/app');
    });
    afterEach(function() {
        process.env = env;
        delete require.cache[require.resolve('../lib/app')];
        if (app.browserSync) {
            app.browserSync.exit();
            app.closeWatchers();
        }
    });

    it('Should register browserSync', function(done) {
        assert.isDefined(app.browserSync);
        request(app).get('/')
            .then(response => {
                const { document } = (new JSDOM(response.text)).window;
                assert.notEqual(document.querySelector("script#__bs_script__"), null);
                done();
            })
            .catch((err) => {
                done(err);
            });
    });
});
