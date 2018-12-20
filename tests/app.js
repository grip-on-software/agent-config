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
        this.timeout(4000);
        env = process.env;
        process.env = {
            'NODE_ENV': 'dev-sync',
            'LISTEN_HOST': 'www.agent-config.test'
        };
        delete require.cache[require.resolve('../lib/app')];
        delete require.cache[require.resolve('../lib/options')];
        app = require('../lib/app');
    });
    afterEach(function() {
        process.env = env;
        delete require.cache[require.resolve('../lib/app')];
        delete require.cache[require.resolve('../lib/options')];
        if (app.browserSync) {
            app.browserSync.exit();
            app.closeWatchers();
        }
    });

    it('Should register browserSync', function(done) {
        assert.isDefined(app.browserSync);
        request(app).get('/')
            .set('Host', 'www.agent-config.test')
            .then(response => {
                const { document } = (new JSDOM(response.text)).window;
                assert.notEqual(document.querySelector("script#__bs_script__"), null);
                done();
            })
            .catch((err) => {
                done(err);
            });
    });

    it('Should use host validation', function(done) {
        request(app).get('/')
            .set('Host', 'www.dns-rebind.test:123')
            .expect(403, done);
    });
});
