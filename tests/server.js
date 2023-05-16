/**
 * Utilities to start upstream servers.
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
