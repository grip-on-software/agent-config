/**
 * Scrape job activation endpoint served at '/scrape' path.
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
'use strict';

const http = require('http'),
      upstream = require('../upstream'),
      config = require('../config');

module.exports = function(app) {
    app.post('/scrape', function(req, res) {
        res.setHeader("Content-Type", "application/json");
        var onReject = function(error) {
            return {
                'ok': false,
                'error': {
                    'message': error
                }
            };
        };
        if (!config.has_value(app.options.agent_host)) {
            res.writeHead(500);
            res.end(JSON.stringify(onReject("No agent host configured")));
            return;
        }

        const upstreamReq = http.request({
            hostname: app.options.agent_host,
            port: app.options.agent_port,
            method: 'POST',
            path: '/scrape'
        }, function(upstreamRes) {
            upstream.channelJSON(res, upstreamRes, 201, onReject);
        });
        upstream.setRequestTimeout(res, upstreamReq, app.options.scrape_timeout,
            onReject
        );
        upstreamReq.end();
    });
};
