/* Index page served at '/' path. */
'use strict';

const fs = require('fs'),
      path = require('path'),
      moment = require('moment'),
      render = require('../template'),
      config = require('../config');

const index_page = fs.readFileSync(__dirname + '/../../template/index.mustache').toString();

const get_status = function(app) {
    const version_file = path.join(app.options.config_path, 'VERSION');
    var config_ok = fs.existsSync(path.join(app.options.config_path, 'settings.cfg'));
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
                  scrape_file = path.join(app.options.export_path,
                                          project_key,
                                          'preflight_date.txt');
            scrape_date = fs.existsSync(scrape_file) ?
                moment(fs.readFileSync(scrape_file), "YYYY-MM-DD HH:mm:ss") : null;
        }
    }
    return { config_ok, version_file, scrape_date };
};

module.exports = function(app) {
    app.get('/', function(req, res) {
        const { config_ok, version_file, scrape_date } = get_status(app);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(render(index_page, {
            title: 'Agent status',
            status_text: config_ok ? 'All good' : 'Not configured',
            status_class: config_ok ? 'ok' : 'fail',
            version: fs.existsSync(version_file) ?
                fs.readFileSync(version_file) : 'unknown',
            ssh_host: config.has_value(app.options.ssh_host) ?
                app.options.ssh_host : false,
            scrape_date: scrape_date ? scrape_date.fromNow() : 'Never',
            scrape_class: scrape_date ? 'time' : 'time-never',
            scrape_title: scrape_date ? scrape_date.format() : 'No information',
            export_url: app.options.export_path !== '' ? '/export' : false,
            visualization_url: config.has_value(app.options.visualization_url) ?
                app.options.visualization_url : false
        }));
    });
};
