/* Unit tests. */
/* jshint mocha: true */
'use strict';

const request = require('supertest'),
      assert = require('chai').assert,
      app = require('../../lib/app');

describe('Static', function() {
    it('Should provide indexes', function() {
        return request(app).get('/config/')
            .expect("Content-Type", "text/html; charset=utf-8")
            .expect(200);
    });

    it('Should open plain files', function() {
        return request(app).get('/config/VERSION')
            .expect("Content-Type", "text/plain")
            .expect("Content-Disposition", "inline")
            .expect(200)
            .expect("test-dev\n");
    });

    it('Should not provide files if configuration is missing', function(done) {
        delete require.cache[require.resolve('../../lib/app')];
        delete require.cache[require.resolve('../../lib/options')];
        const options = require('../../lib/options');
        options.config_path = '';
        options.export_path = '';
        const misApp = require('../../lib/app');
        request(misApp).get('/config/')
            .expect(404)
            .then(() => {
                request(misApp).get('/export/')
                    .expect(404, done);
            });
    });

    it('Should provide jQuery JS files', function() {
        return request(app).get('/jquery/jquery.min.js')
            .expect(200);
    });

    it('Should provide font-awesome CSS files', function() {
        return request(app).get('/font-awesome/all.min.css')
            .expect(200);
    });
});
