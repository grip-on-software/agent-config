/**
 * Unit tests for the /scrape route.
 * 
 * Copyright 2017-2020 ICTU
 * Copyright 2017-2022 Leiden University
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
      app = require('../../lib/app'),
      { createAgent, checkAgentEnvironment } = require('../server');

describe('Scrape', function() {
    it('Should request the scrape to start', function(done) {
        if (!checkAgentEnvironment(app)) {
            return this.skip();
        }
        const upstreamServer = createAgent(app, (req, res) => {
            res.statusCode = 201;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ok: true}));
        });
        request(app).post('/scrape')
            .expect("Content-Type", "application/json")
            .expect(200, {ok: true})
            .end((err, res) => {
                upstreamServer.close();
                if (err) { done(err); }
                else { done(); }
            });
    });

    it('Should provide an error if the agent is misconfigured', function() {
        delete require.cache[require.resolve('../../lib/app')];
        const misApp = require('../../lib/app');
        misApp.options.agent_host = '';
        return request(misApp).post('/scrape')
            .expect("Content-Type", "application/json")
            .expect(500, {
                ok: false,
                error: {
                    message: "No agent host configured"
                }
            });
    });

    it('Should provide an error if the agent is unavailable', function() {
        if (!checkAgentEnvironment(app)) {
            return;
        }
        return request(app).post('/scrape')
            .expect("Content-Type", "application/json")
            .expect(500, {
                ok: false,
                error: {
                    message: `connect ECONNREFUSED 127.0.0.1:${app.options.agent_port}`
                }
            });
    });

    it('Should provide a message if the agent has a status', function(done) {
        if (!checkAgentEnvironment(app)) {
            return this.skip();
        }
        const upstreamServer = createAgent(app, (req, res) => {
            res.writeHead(403);
            res.end("I'm afraid I can't let you do that");
        });
        request(app).post('/scrape')
            .expect("Content-Type", "application/json")
            .expect(200, {
                ok: false,
                error: {
                    message: "I'm afraid I can't let you do that"
                }
            })
            .end((err, res) => {
                upstreamServer.close();
                if (err) { done(err); }
                else { done(); }
            });
    });

    it('Should provide an error if the agent is too slow', function(done) {
        if (!checkAgentEnvironment(app)) {
            return this.skip();
        }
        const upstreamServer = createAgent(app, (req, res) => {
            setTimeout(function() {
                res.end();
            }, app.options.scrape_timeout + 100);
        });
        request(app).post('/scrape')
            .expect("Content-Type", "application/json")
            .expect(500, {
                ok: false,
                error: {
                    message: "Connection to the upstream server timed out"
                }
            })
            .end((err, res) => {
                upstreamServer.close();
                if (err) { done(err); }
                else { done(); }
            });
    });
});
