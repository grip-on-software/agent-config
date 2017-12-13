/* Scrape job activation endpoint served at '/scrape' path. */
'use strict';

const http = require('http'),
      upstream = require('../upstream'),
      options = require('../options'),
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
        if (!config.has_value(options.agent_host)) {
            res.writeHead(500);
            res.end(JSON.stringify(onReject("No agent host configured")));
            return;
        }

        const upstreamReq = http.request({
            hostname: options.agent_host,
            port: options.agent_port,
            method: 'POST',
            path: '/scrape'
        }, function(upstreamRes) {
            upstream.channelJSON(res, upstreamRes, 201, onReject);
        });
        upstream.setRequestTimeout(res, upstreamReq, 1000, onReject);
        upstreamReq.end();
    });
};
