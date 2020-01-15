/* Update check endpoint served at '/update' path. */
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
        var onReject = function(error) {
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
