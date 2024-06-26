/**
 * Unit tests for the /edit route.
 *
 * Copyright 2017-2020 ICTU
 * Copyright 2017-2022 Leiden University
 * Copyright 2017-2023 Leon Helwerda
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/* jshint mocha: true */
'use strict';

const request = require('supertest'),
      assert = require('chai').assert,
      _ = require('lodash'),
      jsdom = require('jsdom'),
      { JSDOM } = jsdom,
      app = require('../../lib/app'),
      { loadPageWithScripts } = require('../res');

global.__coverage__ = global.__coverage__ || {};

const submit_data = {
    'environment[bigboat_url]': 'http://bigboat.example',
    'environment[bigboat_key]': 'my-api-key',
    'environment[jira_key]': 'TEST',
    'environment[quality_report_name]_1[key]': 'TEST',
    'environment[quality_report_name]_1[value]': 'test',
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
    'jenkins_1[jenkins_host]': 'jenkins.example',
    'jenkins_1[jenkins_user]': 'api-user',
    'jenkins_1[jenkins_token]': 'api-pass',
    'jenkins_1[jenkins_unsafe]': '1'
};

describe('Edit', function() {
    it('Should provide a form', function(done) {
        this.timeout(5500);
        request(app).get('/edit')
            .expect('Content-Type', 'text/html')
            .expect(200)
            .then(response => {
                loadPageWithScripts(app, response, done).then(window => {
                    const { document } = window;
                    window.$(document).ready(() => {
                        // Test clone buttons
                        assert.equal(document.querySelectorAll(".component").length, 3);
                        document.querySelector(".component > .clone button.add").click();
                        assert.equal(document.querySelectorAll(".component").length, 4);
                        document.querySelector(".component > .clone button.remove").click();
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
            'environment[quality_report_name]_1[key]': '',
            'environment[quality_report_name]_1[value]': '',
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

    it('Should accept multiple projects with quality reports', function(done) {
        request(app).post('/edit').send(Object.assign({}, submit_data, {
            'environment[quality_report_name]_2[key]': 'EX',
            'environment[quality_report_name]_2[value]': 'example',
            'environment[quality_time_url]': 'http://qt.test',
            'environment[sonar_url]': 'http://sonar.test',
        })).then(() => {
            request(app).get('/edit')
                .expect('Content-Type', 'text/html')
                .expect(200)
                .then(response => {
                    const { window } = new JSDOM(response.text);
                    window.__coverage__ = global.__coverage__;
                    const { document } = window;
                    assert.equal(document.querySelector("input#id_environment\\[quality_report_name\\]_2\\[key\\]").value, "EX");
                    assert.equal(document.querySelector("input#id_environment\\[quality_report_name\\]_2\\[value\\]").value, "example");
                    assert.equal(document.querySelector("input#id_environment\\[quality_time_url\\]").value, "http://qt.test");
                    assert.equal(document.querySelector("input#id_environment\\[sonar_url\\]").value, "http://sonar.test");
                    done();
                }).catch((err) => {
                    done(err);
                });
        }).catch((err) => {
            done(err);
        });
    });

    it('Should provide correct configuration when adding and removing sources', (done) => {
        const new_data = _.assign({},
            _.transform(submit_data, (result, value, key) => {
                if (!key.startsWith('version_control_1')) {
                    const newKey = key.replace('version_control_2', 'version_control_1');
                    result[newKey] = value;
                }
            }, {}),
            {'version_control_1[version_control_group]': 'TfsCollection'},
            {
                'jenkins_2[jenkins_host]': 'ci.example',
                'jenkins_2[jenkins_user]': 'newuser',
                'jenkins_2[jenkins_token]': 'newpass',
                'jenkins_2[jenkins_unsafe]': '',
                'jenkins_3[jenkins_host]': '',
                'jenkins_3[jenkins_user]': '',
                'jenkins_3[jenkins_token]': '',
                'jenkins_3[jenkins_unsafe]': '',
            }
        );
        request(app).post('/edit').send(new_data).then(() => {
            request(app).get('/edit')
                .expect('Content-Type', 'text/html')
                .expect(200)
                .then(response => {
                    const { window } = new JSDOM(response.text);
                    window.__coverage__ = global.__coverage__;
                    const { document } = window;
                    assert.equal(document.querySelector("input#id_version_control_1\\[version_control_domain\\]").value, "tfs.example");
                    assert.equal(document.querySelector("input#id_version_control_1\\[version_control_user\\]").value, "tfs\\user");
                    assert.equal(document.querySelector("input#id_version_control_1\\[version_control_group\\]").value, "TfsCollection");
                    assert.equal(document.querySelector("input#id_jenkins_1\\[jenkins_host\\]").value, "jenkins.example");
                    assert.equal(document.querySelector("input#id_jenkins_1\\[jenkins_user\\]").value, "api-user");
                    assert.equal(document.querySelector("input#id_jenkins_2\\[jenkins_host\\]").value, "ci.example");
                    assert.equal(document.querySelector("input#id_jenkins_2\\[jenkins_user\\]").value, "newuser");
                    // No field is added for extra/empty Jenkins
                    assert.equal(document.querySelector("input#id_jenkins_3\\[jenkins_host\\]"), null);
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
