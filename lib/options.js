/**
 * Configuration options of the application.
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

const fs = require('fs'),
      _ = require('lodash');
const config = JSON.parse(fs.readFileSync(fs.existsSync(`${__dirname}/../config.json`) ?
    `${__dirname}/../config.json` : `${__dirname}/config.json`
));

function getConfig(envKey, configKey) {
    return envKey in process.env ? process.env[envKey] : config[configKey];
}

const ENV_KEYS = {
    key_path: 'IDENTITY_PATH',
    listen_address: 'LISTEN_ADDR'
};

const options = _.mapValues(config, (value, key) => {
    const envKey = ENV_KEYS[key] || key.toUpperCase();
    if (_.has(process.env, envKey)) {
        return _.isNumber(value) ? Number(process.env[envKey]) :
            process.env[envKey];
    }
    return value;
});

module.exports = options;
