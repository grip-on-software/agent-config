/* Unit tests for the /scrape route. */
/* jshint mocha: true */
'use strict';

const request = require('supertest'),
      express = require('express'),
      http = require('http'),
      app = require('../../lib/app');

const createUpstream = function(handler) {
    const upstreamApp = express(),
          upstreamServer = http.createServer(upstreamApp);
    upstreamApp.post('/scrape', handler);
    upstreamServer.listen(app.options.agent_port);
    return upstreamServer;
};

const checkEnvironment = function(app) {
    if (app.options.agent_host === 'localhost') {
        return true;
    }
    return false;
};

describe('Scrape', function() {
    it('Should request the scrape to start', function(done) {
        if (!checkEnvironment(app)) {
            return this.skip();
        }
        const upstreamServer = createUpstream((req, res) => {
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
        if (!checkEnvironment(app)) {
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

    it('Should provide an error if the agent is too slow', function(done) {
        if (!checkEnvironment(app)) {
            return this.skip();
        }
        const upstreamServer = createUpstream((req, res) => {
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
