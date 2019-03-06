/* Unit tests. */
/* jshint mocha: true */
'use strict';

const request = require('supertest'),
      assert = require('chai').assert,
      jsdom = require('jsdom'),
      { JSDOM } = jsdom,
      app = require('../../lib/app'),
      { loadPageWithScripts } = require('../res');

global.__coverage__ = global.__coverage__ || {};

const submit_data = {
    'bigboat_url': 'http://bigboat.example',
    'bigboat_key': 'my-api-key',
    'jira_key': 'TEST',
    'quality_report_name': 'test',
    'version_control_1[version_control_type]': 'gitlab',
    'version_control_1[version_control_domain]': 'gitlab.example',
    'version_control_1[version_control_auth]': 'gitlab_api',
    'version_control_1[version_control_user]': 'git',
    'version_control_1[version_control_token]': 'apikey',
    'version_control_1[version_control_group]': 'example',
    'version_control_1[version_control_source]_1[key]': 'testrepo',
    'version_control_1[version_control_source]_1[value]': 'http://gitlab.example/example/repo',
    'version_control_2[version_control_type]': 'tfs',
    'version_control_2[version_control_domain]': 'tfs.example',
    'version_control_2[version_control_auth]': 'deploy_key',
    'version_control_2[version_control_user]': 'tfs\\user',
    'version_control_2[version_control_key]': 'deploykey',
    'version_control_2[version_control_unsafe]': '1',
    'version_control_2[version_control_skip_stats]': '1',
    'jenkins_host': 'http://jenkins.example',
    'jenkins_user': 'api-user',
    'jenkins_token': 'api-pass'
};

describe('Edit', function() {
    it('Should provide a form', function(done) {
        request(app).get('/edit')
            .expect('Content-Type', 'text/html')
            .expect(200)
            .then(response => {
                loadPageWithScripts(app, response, done).then(window => {
                    const { document } = window;
                    window.$(document).ready(() => {
                        // Test clone buttons
                        assert.equal(document.querySelectorAll(".component").length, 3);
                        document.querySelector(".component .clone button.add").click();
                        assert.equal(document.querySelectorAll(".component").length, 4);
                        document.querySelector(".component .clone button.remove").click();
                        assert.equal(document.querySelectorAll(".component").length, 3);

                        // Test expand button
                        assert.equal(document.querySelector(".component .expand").style.display, "none");
                        document.querySelector(".component .toggle-expand").click();
                        assert.equal(document.querySelectorAll(".component .toggle-collapse").length, 1);
                        assert.equal(document.querySelector(".component .expand").style.display, "block");
                        document.querySelector(".component .toggle-collapse").click();
                        assert.equal(document.querySelectorAll(".component .toggle-collapse").length, 0);
                        assert.equal(document.querySelector(".component .expand").style.display, "none");
                        done();
                    });
                }).catch((err) => {
                    done(err);
                });
            }).catch((err) => {
                done(err);
            });
    });

    it('Should handle a form submission', function() {
        return request(app).post('/edit')
            .send(submit_data)
            .expect('Content-Type', 'text/html')
            .expect(200)
            .then(response => {
                const { window } = new JSDOM(response.text);
                window.__coverage__ = global.__coverage__;
                const { document } = window;
                assert.equal(document.querySelector("h1").textContent, "Success");
            });
    });

    it('Should handle a form submission when options are missing', function() {
        delete require.cache[require.resolve('../../lib/app')];
        const misApp = require('../../lib/app');
        misApp.options.config_path = '';
        misApp.options.agent_host = '';
        return request(misApp).post('/edit')
            .send(submit_data)
            .expect('Content-Type', 'text/html')
            .expect(200)
            .then(response => {
                const { window } = new JSDOM(response.text);
                window.__coverage__ = global.__coverage__;
                const { document } = window;
                assert.equal(document.querySelector("h1").textContent, "Success");
                assert.equal(document.querySelectorAll("li").length, 2);
            });
    });

    it('Should provide a new form after submission', function(done) {
        request(app).post('/edit').send(submit_data).then(() => {
            request(app).get('/edit')
                .expect('Content-Type', 'text/html')
                .expect(200)
                .then(response => {
                    const { window } = new JSDOM(response.text);
                    window.__coverage__ = global.__coverage__;
                    const { document } = window;
                    assert.equal(document.querySelectorAll(".component").length, 4);
                    assert.equal(document.querySelectorAll("input[value=\"<existing>\"]").length, 3);
                    assert.equal(document.querySelector("textarea#id_version_control_2\\[version_control_key\\]").textContent, "<existing>");
                    done();
                }).catch((err) => {
                    done(err);
                });
        }).catch((err) => {
            done(err);
        });
    });

    it('Should provide source when submitting no quality report', function(done) {
        request(app).post('/edit').send(Object.assign({}, submit_data, {
            'quality_report_name': '',
        })).then(() => {
            request(app).get('/edit')
                .expect('Content-Type', 'text/html')
                .expect(200)
                .then(response => {
                    const { window } = new JSDOM(response.text);
                    window.__coverage__ = global.__coverage__;
                    const { document } = window;
                    assert.equal(document.querySelector("input#id_version_control_1\\[version_control_source\\]_1\\[key\\]").value, "testrepo");
                    assert.equal(document.querySelector("input#id_version_control_1\\[version_control_source\\]_1\\[value\\]").value, "http://gitlab.example/example/repo");
                    done();
                }).catch((err) => {
                    done(err);
                });
        }).catch((err) => {
            done(err);
        });
    });
});

describe('Edit success', function() {
    it('Should perform a scrape after submitting the form', function(done) {
        request(app).post('/edit').send(submit_data)
            .then(response => {
                loadPageWithScripts(app, response, done).then(window => {
                    const { document } = window;
                    window.$(document).ready(() => {
                        document.querySelector("#options button.scrape").click();
                        assert.equal(document.querySelector("#options button.scrape"), null);
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
