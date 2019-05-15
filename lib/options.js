/* Configuration options of the application. */
'use strict';

const fs = require('fs'),
      _ = require('lodash');
const config = JSON.parse(fs.readFileSync(fs.existsSync(__dirname + '/../config.json') ?
    __dirname + '/../config.json' : __dirname + '/config.json'
));

function getConfig(env_key, config_key) {
    return env_key in process.env ? process.env[env_key] : config[config_key];
}

const env_keys = {
    key_path: 'IDENTITY_PATH',
    listen_address: 'LISTEN_ADDR'
};

const options = _.mapValues(config, (value, key) => {
    const env_key = env_keys[key] || key.toUpperCase();
    if (_.has(process.env, env_key)) {
        return _.isNumber(value) ? Number(process.env[env_key]) :
            process.env[env_key];
    }
    return value;
});

module.exports = options;
