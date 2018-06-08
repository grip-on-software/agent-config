/* Utilities to start upstream servers. */
'use strict';

const request = require('supertest'),
      express = require('express'),
      fs = require('fs'),
      http = require('http'),
      https = require('https');

exports.createAgent = function(app, handler) {
    const upstreamApp = express(),
          upstreamServer = http.createServer(upstreamApp);
    upstreamApp.post('/scrape', handler);
    upstreamServer.listen(app.options.agent_port);
    return upstreamServer;
};

exports.checkAgentEnvironment = function(app) {
    if (app.options.agent_host === 'localhost') {
        return true;
    }
    return false;
};

exports.createUpdate = function(app, handler) {
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

exports.checkUpdateEnvironment = function(app) {
    const cert = app.options.ssh_https_cert;
    if (app.options.ssh_host === 'localhost' && fs.existsSync(`${cert}.key`)) {
        return true;
    }
    return false;
};
