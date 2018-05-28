/* Unit tests for the /update route. */
/* jshint mocha: true */
'use strict';

const request = require('supertest'),
      express = require('express'),
      fs = require('fs'),
      https = require('https'),
      app = require('../../lib/app');

const createUpstream = function(handler) {
    const cert = app.options.ssh_https_cert,
          upstreamApp = express(),
          upstreamServer = https.createServer({
              key: fs.readFileSync(`${cert}.key`),
              cert: fs.readFileSync(cert)
          }, upstreamApp);
    upstreamApp.get('/auth/version.py', handler);
    upstreamServer.listen(app.options.ssh_https_port);
    return upstreamServer;
};

const checkEnvironment = function(app) {
    const cert = app.options.ssh_https_cert;
    if (app.options.ssh_host === 'localhost' && fs.existsSync(`${cert}.key`)) {
        return true;
    }
    return false;
};

describe('Update', function() {
    it('Should check for updates', function(done) {
        if (!checkEnvironment(app)) {
            return this.skip();
        }
        const upstreamServer = createUpstream((req, res) => {
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

    it('Should provide an error if the upstream is unavailable', function() {
        if (!checkEnvironment(app)) {
            return this.skip();
        }
        return request(app).get('/update')
            .expect("Content-Type", "application/json")
            .expect(500, {
                up_to_date: false,
                message: `connect ECONNREFUSED 127.0.0.1:${app.options.ssh_https_port}`
            });
    });

    it('Should provide an error if the upstream is too slow', function(done) {
        if (!checkEnvironment(app)) {
            return this.skip();
        }
        const upstreamServer = createUpstream((req, res) => {
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
