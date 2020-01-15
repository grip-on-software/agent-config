/* Index page served at '/' path. */
'use strict';

const fs = require('fs'),
      path = require('path'),
      _ = require('lodash'),
      moment = require('moment'),
      render = require('../template'),
      config = require('../config');

const INDEX_PAGE = fs.readFileSync(`${__dirname}/../../template/index.mustache`).toString();

function get_status(app) {
    const versionFile = path.join(app.options.config_path, 'VERSION');
    var hasConfig = fs.existsSync(path.join(app.options.config_path, 'settings.cfg'));
    var scrapeDate = moment.invalid();
    if (hasConfig) {
        const settings = config.read('settings.cfg');
        if (!settings.hasSection('projects') ||
            settings.keys('projects').length === 0 ||
            !config.has_value(settings.keys('projects')[0])
        ) {
            hasConfig = false;
        }
        else {
            scrapeDate = _.min(_.map(settings.keys('projects'),
                function(projectKey) {
                    const scrapeFile = path.join(app.options.export_path,
                        projectKey, 'preflight_date.txt'
                    );
                    return !fs.existsSync(scrapeFile) ? moment.invalid() :
                        moment(fs.readFileSync(scrapeFile), "YYYY-MM-DD HH:mm:ssZZ");
                }
            ));
        }
    }
    return { hasConfig, versionFile, scrapeDate };
}

function get_status_time(date) {
    if (!date.isValid()) {
        return 'time-never';
    }
    else if (moment().diff(date, 'days') > 1) {
        return 'time-old';
    }
    return 'time';
}

module.exports = function(app) {
    app.get('/', function(req, res) {
        const { hasConfig, versionFile, scrapeDate } = get_status(app);
        const scrapeStatus = get_status_time(scrapeDate);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(render(INDEX_PAGE, {
            title: 'Agent status',
            status_text: hasConfig ? 'All good' : 'Not configured',
            status_class: hasConfig ? 'ok' : 'fail',
            version: fs.existsSync(versionFile) ?
                fs.readFileSync(versionFile) : 'unknown',
            ssh_host: config.has_value(app.options.ssh_host) ?
                app.options.ssh_host : false,
            scrape_date: scrapeDate.isValid() ? scrapeDate.fromNow() : 'Never',
            scrape_class: scrapeStatus,
            scrape_title: scrapeDate.isValid() ? scrapeDate.format() : 'No information',
            export_url: app.options.export_path !== '' ? '/export' : false,
            visualization_url: config.has_value(app.options.visualization_url) ?
                app.options.visualization_url : false
        }));
    });
};
