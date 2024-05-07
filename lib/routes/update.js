/**
 * Update check endpoint served at '/update' path.
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

const fs = require('fs'),
      https = require('https'),
      path = require('path'),
      querystring = require('qs'),
      upstream = require('../upstream'),
      config = require('../config');

module.exports = function(app) {
    app.get('/update', function(req, res) {
        res.setHeader("Content-Type", "application/json");
        const onReject = function(error) {
            return {
                up_to_date: false,
                message: error
            };
        };
        if (!config.has_value(app.options.ssh_host)) {
            res.writeHead(500);
            res.end(JSON.stringify(onReject("No controller host configured")));
            return;
        }

        const versionFile = path.join(app.options.config_path, 'VERSION');
        if (!fs.existsSync(versionFile)) {
            res.writeHead(500);
            res.end(JSON.stringify(onReject("No version known")));
            return;
        }

        const version = fs.readFileSync(versionFile).toString().trim();
        const upstreamReq = https.get({
            hostname: app.options.ssh_host,
            port: app.options.ssh_https_port,
            path: `/auth/version.py?${querystring.stringify({version: version})}`,
            ca: fs.readFileSync(app.options.ssh_https_cert)
        }, function(upstreamRes) {
            upstream.channelJSON(res, upstreamRes, 200, onReject);
        });
        upstream.setRequestTimeout(res, upstreamReq, app.options.update_timeout,
            onReject
        );
    });
};
