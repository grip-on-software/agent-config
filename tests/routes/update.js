/**
 * Unit tests for the /update route.
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

const dns = require('dns'),
      request = require('supertest'),
      app = require('../../lib/app'),
      { checkUpdateEnvironment, createUpdate } = require('../server');

describe('Update', function() {
    it('Should check for updates', function(done) {
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
        request(app).get('/update')
            .expect("Content-Type", "application/json")
            .expect(200, {
                up_to_date: false,
                version: "abc"
            })
            .end((err, res) => {
                upstreamServer.close();
                if (err) { done(err); }
                else { done(); }
            });
    });

    it('Should provide an error if no version file is configured', function() {
        delete require.cache[require.resolve('../../lib/app')];
        const misApp = require('../../lib/app');
        misApp.options.config_path = '/dev/null';
        return request(misApp).get('/update')
            .expect("Content-Type", "application/json")
            .expect(500, {
                up_to_date: false,
                message: "No version known"
            });
    });

    it('Should provide an error if the upstream is misconfigured', function() {
        delete require.cache[require.resolve('../../lib/app')];
        const misApp = require('../../lib/app');
        misApp.options.ssh_host = '';
        return request(misApp).get('/update')
            .expect("Content-Type", "application/json")
            .expect(500, {
                up_to_date: false,
                message: "No controller host configured"
            });
    });

    it('Should provide an error if the upstream is unavailable', function(done) {
        if (!checkUpdateEnvironment(app)) {
            return this.skip();
        }
        dns.lookup('localhost', (err, address, family) => {
            request(app).get('/update')
                .expect("Content-Type", "application/json")
                .expect(500, {
                    up_to_date: false,
                    message: `connect ECONNREFUSED ${address}:${app.options.ssh_https_port}`
                })
                .end((err, res) => {
                    if (err) { done(err); }
                    else { done(); }
                });
        });
    });

    it('Should provide a message if the upstream has a status', function(done) {
        if (!checkUpdateEnvironment(app)) {
            return this.skip();
        }
        const upstreamServer = createUpdate(app, (req, res) => {
            res.writeHead(403);
            res.end("I'm afraid I can't let you do that");
        });
        request(app).get('/update')
            .expect("Content-Type", "application/json")
            .expect(200, {
                up_to_date: false,
                message: "I'm afraid I can't let you do that"
            })
            .end((err, res) => {
                upstreamServer.close();
                if (err) { done(err); }
                else { done(); }
            });
    });

    it('Should provide an error if the upstream is too slow', function(done) {
        if (!checkUpdateEnvironment(app)) {
            return this.skip();
        }
        const upstreamServer = createUpdate(app, (req, res) => {
            setTimeout(function() {
                res.end();
            }, app.options.update_timeout + 100);
        });
        request(app).get('/update')
            .expect("Content-Type", "application/json")
            .expect(500, {
                up_to_date: false,
                message: "Connection to the upstream server timed out"
            })
            .end((err, res) => {
                upstreamServer.close();
                if (err) { done(err); }
                else { done(); }
            });
    });
});
