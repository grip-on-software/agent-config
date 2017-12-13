/* Configuration options of the application. */
'use strict';

const fs = require('fs');
const config = JSON.parse(fs.readFileSync(fs.existsSync(__dirname + '/../config.json') ? 
    __dirname + '/../config.json' : __dirname + '/config.json'
));

function getConfig(env_key, config_key) {
    return env_key in process.env ? process.env[env_key] : config[config_key];
}

const options = {
    export_path: getConfig('EXPORT_PATH', 'export_path'),
    config_path: getConfig('CONFIG_PATH', 'config_path'),
    key_path: getConfig('IDENTITY_PATH', 'key_path'),
    listen_address: getConfig('LISTEN_ADDR', 'listen_address'),
    listen_port: Number(getConfig('LISTEN_PORT', 'listen_port')),
    ssh_host: getConfig('SSH_HOST', 'ssh_host'),
    agent_host: getConfig('AGENT_HOST', 'agent_host'),
    agent_port: Number(getConfig('AGENT_PORT', 'agent_port')),
    visualization_url: getConfig('VISUALIZATION_URL', 'visualization_url')
};

module.exports = options;