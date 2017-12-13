/* Update check endpoint served at '/update' path. */
'use strict';

const fs = require('fs'),
      https = require('https'),
      path = require('path'),
      querystring = require('qs'),
      upstream = require('../upstream'),
      options = require('../options'),
      config = require('../config');

module.exports = function(app) {
    app.get('/update', function(req, res) {
        res.setHeader("Content-Type", "application/json");
        var onReject = function(error) {
            return {
                up_to_date: false,
                message: error
            };
        };
        if (!config.has_value(options.ssh_host)) {
            res.writeHead(500);
            res.end(JSON.stringify(onReject("No controller host configured")));
            return;
        }

        const version_file = path.join(options.config_path, 'VERSION');
        if (!fs.existsSync(version_file)) {
            res.writeHead(500);
            res.end(JSON.stringify(onReject("No version known")));
            return;
        }

        const version = fs.readFileSync(version_file).toString().trim();
        const upstreamReq = https.get({
            hostname: options.ssh_host,
            port: 443,
            path: `/auth/version.py?${querystring.stringify({version: version})}`,
            rejectUnauthorized: false
        }, function(upstreamRes) {
            upstream.channelJSON(res, upstreamRes, 200, onReject);
        });
        upstream.setRequestTimeout(res, upstreamReq, 2000, onReject);
    });
};
