/* Configuration options of the application. */
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
