/* Index page served at '/' path. */
'use strict';

const fs = require('fs'),
      path = require('path'),
      moment = require('moment'),
      render = require('../template'),
      options = require('../options'),
      config = require('../config');

const index_page = fs.readFileSync(__dirname + '/../../template/index.mustache').toString();

module.exports = function(app) {
    app.get('/', function(req, res) {
        const version_file = path.join(options.config_path, 'VERSION');
        var config_ok = fs.existsSync(path.join(options.config_path, 'settings.cfg'));
        var scrape_date = null;
        if (config_ok) {
            const settings = config.read('settings.cfg');
            if (!settings.hasSection('projects') ||
                settings.keys('projects').length === 0 ||
                !config.has_value(settings.keys('projects')[0])
            ) {
                config_ok = false;
            }
            else {
                const project_key = settings.keys('projects')[0],
                      scrape_file = path.join(options.export_path, project_key,
                                              'preflight_date.txt');
                scrape_date = fs.existsSync(scrape_file) ?
                    moment(fs.readFileSync(scrape_file), "YYYY-MM-DD HH:mm:ss") : null;
            }
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(render(index_page, {
            title: 'Agent status',
            status_text: config_ok ? 'All good' : 'Not configured',
            status_class: config_ok ? 'ok' : 'fail',
            version: fs.existsSync(version_file) ?
                fs.readFileSync(version_file) : 'unknown',
            ssh_host: config.has_value(options.ssh_host) ? options.ssh_host : false,
            scrape_date: scrape_date ? `<span class="time" title="${scrape_date.format()}">${scrape_date.fromNow()}</span>` : '<span class="time-never">Never</span>',
            export_url: options.export_path !== '' ? '/export' : false,
            visualization_url: config.has_value(options.visualization_url) ?
                options.visualization_url : false
        }));
    });
};
