/* Unit tests. */
/* jshint mocha: true */
'use strict';

const fs = require('fs'),
      request = require('supertest'),
      assert = require('chai').assert,
      app = require('../../lib/app'),
      { loadPageWithScripts } = require('../res');

describe('Index', function() {
    afterEach(function() {
        if (fs.existsSync('test-config/settings.cfg')) {
            fs.unlinkSync('test-config/settings.cfg');
        }
        if (fs.existsSync('test-export/TEST/preflight_date.txt')) {
            fs.unlinkSync('test-export/TEST/preflight_date.txt');
        }
        fs.writeFileSync('test-config/VERSION', 'test-dev\n');
    });

    it('Should provide a page', function() {
        return request(app).get('/')
            .expect('Content-Type', 'text/html')
            .expect(200);
    });

    it('Should provide OK status if configured', function(done) {
        fs.writeFileSync('test-config/settings.cfg', '[projects]\nTEST=');
        request(app).get('/')
            .then(response => {
                loadPageWithScripts(app, response, done).then(window => {
                    const { document } = window;
                    assert.equal(document.querySelectorAll(".status-ok").length, 1);
                    done();
                }).catch((err) => {
                    done(err);
                });
            }).catch((err) => {
                done(err);
            });
    });

    it('Should provide scrape date if configured', function(done) {
        fs.writeFileSync('test-config/settings.cfg', '[projects]\nTEST=');
        if (!fs.existsSync('test-export/TEST')) {
            fs.mkdirSync('test-export/TEST');
        }
        fs.writeFileSync('test-export/TEST/preflight_date.txt', '1970-01-01 00:00:01');
        request(app).get('/')
            .then(response => {
                loadPageWithScripts(app, response, done).then(window => {
                    const { document } = window;
                    assert.equal(document.querySelectorAll(".time").length, 1);
                    done();
                }).catch((err) => {
                    done(err);
                });
            }).catch((err) => {
                done(err);
            });
    });

    it('Should indicate a failed agent status if misconfigured', function(done) {
        fs.writeFileSync('test-config/settings.cfg', '');
        fs.unlinkSync('test-config/VERSION');
        delete require.cache[require.resolve('../../lib/app')];
        const misApp = require('../../lib/app');
        misApp.options.export_path = '';
        misApp.options.ssh_host = '';
        misApp.options.visualization_url = '';
        request(misApp).get('/')
            .then(response => {
                loadPageWithScripts(misApp, response, done).then(window => {
                    const { document } = window;
                    assert.equal(document.querySelectorAll(".status-fail").length, 1);
                    assert.equal(document.querySelectorAll(".time-never").length, 1);
                    assert.include(document.querySelector("#version").textContent, "unknown");
                    assert.equal(document.querySelectorAll("#version .update").length, 0);
                    assert.equal(document.querySelectorAll("#scrape a").length, 0);
                    assert.equal(document.querySelectorAll("a#link").length, 0);
                    done();
                }).catch((err) => {
                    done(err);
                });
            }).catch((err) => {
                done(err);
            });
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
