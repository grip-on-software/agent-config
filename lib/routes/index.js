/**
 * Index page served at '/' path.
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
      path = require('path'),
      _ = require('lodash'),
      moment = require('moment'),
      render = require('../template'),
      config = require('../config');

const INDEX_PAGE = fs.readFileSync(`${__dirname}/../../template/index.mustache`).toString();

function get_status(app) {
    const versionFile = path.join(app.options.config_path, 'VERSION');
    let hasConfig = fs.existsSync(path.join(app.options.config_path,
        'settings.cfg'
    ));
    let scrapeDate = moment.invalid();
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
                        moment(fs.readFileSync(scrapeFile),
                            "YYYY-MM-DD HH:mm:ssZZ"
                        );
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
