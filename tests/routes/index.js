/* Unit tests. */
/* jshint mocha: true */
'use strict';

const fs = require('fs'),
      request = require('supertest'),
      moment = require('moment'),
      assert = require('chai').assert,
      app = require('../../lib/app'),
      { checkUpdateEnvironment, createUpdate } = require('../server'),
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
        const dates = [
            ['invalid', 'time-never'],
            ['1970-01-01 00:00:01', 'time-old'],
            [moment().format('YYYY-MM-DD HH:mm:ss'), 'time']
        ];
        dates.reduce((promise, dateTest) => {
            return new Promise((resolve, reject) => {
                promise.then(() => {
                    const [date, dateStatus] = dateTest;
                    fs.writeFileSync('test-export/TEST/preflight_date.txt', date);
                    request(app).get('/')
                        .then(response => {
                            loadPageWithScripts(app, response, done).then(window => {
                            const { document } = window;
                            assert.equal(document.querySelectorAll(`.${dateStatus}`).length, 1, `Expecting one element with class ${dateStatus}`);
                            resolve();
                        }).catch((err) => {
                            reject(err);
                        });
                    }).catch((err) => {
                        reject(err);
                    });
                }).catch((err) => {
                    reject(err);
                });
            });
        }, Promise.resolve()).then(() => done()).catch((err) => done(err));
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
                    assert.equal(document.querySelectorAll("p#link").length, 0);
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

    it('Should handle an update status message', function(done) {
        if (!checkUpdateEnvironment(app)) {
            return this.skip();
        }
        const upstreamServer = createUpdate(app, (req, res) => {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({
                up_to_date: false,
                version: "abc"
            }));
        });
        request(app).get('/')
            .then(response => {
                loadPageWithScripts(app, response, done).then(window => {
                    const { document } = window;
                    window.$(document).ready(() => {
                        document.querySelector("#version button.update").click();
                        assert.equal(document.querySelector("#version button.update"), null);
                        upstreamServer.close();
                        done();
                    });
                }).catch((err) => {
                    upstreamServer.close();
                    done(err);
                });
            }).catch((err) => {
                upstreamServer.close();
                done(err);
            });
    });
});
