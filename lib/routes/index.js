/* Index page served at '/' path. */
'use strict';

const fs = require('fs'),
      path = require('path'),
      _ = require('lodash'),
      moment = require('moment'),
      render = require('../template'),
      config = require('../config');

const index_page = fs.readFileSync(__dirname + '/../../template/index.mustache').toString();

const get_status = function(app) {
    const version_file = path.join(app.options.config_path, 'VERSION');
    var config_ok = fs.existsSync(path.join(app.options.config_path, 'settings.cfg'));
    var scrape_date = moment.invalid();
    if (config_ok) {
        const settings = config.read('settings.cfg');
        if (!settings.hasSection('projects') ||
            settings.keys('projects').length === 0 ||
            !config.has_value(settings.keys('projects')[0])
        ) {
            config_ok = false;
        }
        else {
            scrape_date = _.min(_.map(settings.keys('projects'),
                function(project_key) {
                    const scrape_file = path.join(app.options.export_path,
                        project_key, 'preflight_date.txt'
                    );
                    return !fs.existsSync(scrape_file) ? moment.invalid() :
                        moment(fs.readFileSync(scrape_file), "YYYY-MM-DD HH:mm:ssZZ");
                }
            ));
        }
    }
    return { config_ok, version_file, scrape_date };
};

const get_status_time = function(date) {
    if (!date.isValid()) {
        return 'time-never';
    }
    else if (moment().diff(date, 'days') > 1) {
        return 'time-old';
    }
    return 'time';
};

module.exports = function(app) {
    app.get('/', function(req, res) {
        const { config_ok, version_file, scrape_date } = get_status(app);
        const scrape_status = get_status_time(scrape_date);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(render(index_page, {
            title: 'Agent status',
            status_text: config_ok ? 'All good' : 'Not configured',
            status_class: config_ok ? 'ok' : 'fail',
            version: fs.existsSync(version_file) ?
                fs.readFileSync(version_file) : 'unknown',
            ssh_host: config.has_value(app.options.ssh_host) ?
                app.options.ssh_host : false,
            scrape_date: scrape_date.isValid() ? scrape_date.fromNow() : 'Never',
            scrape_class: scrape_status,
            scrape_title: scrape_date.isValid() ? scrape_date.format() : 'No information',
            export_url: app.options.export_path !== '' ? '/export' : false,
            visualization_url: config.has_value(app.options.visualization_url) ?
                app.options.visualization_url : false
        }));
    });
};
