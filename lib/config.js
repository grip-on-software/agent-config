/* Configuration reader and writer for the agent. */
'use strict';

const fs = require('fs'),
      path = require('path'),
      configparser = require('configparser'),
      options = require('./options');

const falsy_values = new Set(['false', 'no', 'off', '-', '0', '', null, undefined]);
exports.has_value = function config_has_value(value) {
    return !falsy_values.has(value);
};
exports.existing_value = '<existing>';

exports.read = function read_config(filename) {
    const config = new configparser();
    const file_path = path.join(options.config_path, filename);
    if (fs.existsSync(file_path)) {
        config.read(file_path);
    }
    return config;
};

const replaceSection = function(config, section) {
    config.removeSection(section);
    config.addSection(section);
};
const setOption = function(config, section, option, value, condition=true) {
    config.set(section, option, condition ? value : '-');
};
const writeConfig = function(config, filename) {
    const file_path = path.join(options.config_path, filename);
    config.write(file_path);
};

function createKey(auth, domain, key) {
    var key_file = path.join(options.key_path, 'id_rsa');
    if (auth === 'deploy_key' && key !== '') {
        key_file = path.join(options.key_path, 'source_' + domain);
        if (key !== exports.existing_value) {
            fs.writeFileSync(key_file, key);
        }
    }
    return key_file;
}

function createSources(sources, vcs_type, domain, group, checkouts) {
    checkouts = typeof checkouts === 'undefined' ? [] :
        [].concat(checkouts).filter(function(source) {
            return source.value !== '';
        });
    if (checkouts.length > 0) {
        checkouts.forEach(function(source) {
            sources.push({
                "type": vcs_type,
                "url": source.value,
                "name": `dummy ${source.key === '' ? 'repository on' : source.key} ${domain}`
            });
        });
    }
    else if (group !== '') {
        if (vcs_type === 'gitlab') {
            sources.push({
                "type": "gitlab",
                "url": `http://${domain}/${group}/${group}.git`,
                "name": `gitlab repository on ${domain}`
            });
        }
        else if (vcs_type === 'tfs') {
            sources.push({
                "type": "tfs",
                "url": `http://${domain}/${group}/_git/Dummy`,
                "name": `tfs repository on ${domain}`
            });
        }
    }
}

function set_credentials(credentials, data, index, sources) {
    const domain = [].concat(data.version_control_domain)[index],
          auth = [].concat(data.version_control_auth)[index],
          vcs_type = [].concat(data.version_control_type)[index],
          user = [].concat(data.version_control_user)[index],
          token = [].concat(data.version_control_token)[index],
          key = [].concat(data.version_control_key)[index],
          group = [].concat(data.version_control_group)[index],
          checkouts = [].concat(data.version_control_source)[index],
          unsafe = [].concat(data.version_control_unsafe)[index],
          skip_stats = [].concat(data.version_control_skip_stats)[index],
          from_date = [].concat(data.version_control_from_date)[index],
          tag = [].concat(data.version_control_tag)[index];

    var key_file = createKey(auth, domain, key);
    createSources(sources, vcs_type, domain, group, checkouts);

    var credentials_env = '-';
    var credentials_assign = '';
    if (auth !== 'user_pass') {
        credentials_env = `SOURCE_${index}_CREDENTIALS_ENV`;
        credentials_assign = `${credentials_env}=${key_file}`;
    }

    replaceSection(credentials, domain);

    setOption(credentials, domain, 'type', vcs_type);
    setOption(credentials, domain, 'env', credentials_env);
    setOption(credentials, domain, 'username', user, user !== '');
    setOption(credentials, domain, 'password', token,
        ['user_pass', 'deploy_key'].includes(auth)
    );
    setOption(credentials, domain, 'github_api_url', '-');
    setOption(credentials, domain, 'github_token', token,
        auth === 'github_api'
    );
    setOption(credentials, domain, 'github_bots', '-');
    const tfs_group = (group !== '' ? group : 'true');
    setOption(credentials, domain, 'tfs', tfs_group, vcs_type === 'tfs');
    setOption(credentials, domain, 'gitlab_token', token,
        auth === 'gitlab_api'
    );
    setOption(credentials, domain, 'group', group, vcs_type === 'gitlab');
    setOption(credentials, domain, 'unsafe_hosts', 'true', unsafe);
    setOption(credentials, domain, 'skip_stats', 'true', skip_stats);
    setOption(credentials, domain, 'from_date', from_date);
    setOption(credentials, domain, 'tag', tag);

    return credentials_assign;
}

function set_jenkins_credentials(credentials, data, index, sources) {
    const domain = [].concat(data.jenkins_host)[index],
          user = [].concat(data.jenkins_user)[index],
          token = [].concat(data.jenkins_token)[index],
          unsafe = [].concat(data.jenkins_unsafe)[index];
    replaceSection(credentials, domain);
    setOption(credentials, domain, 'type', 'jenkins');
    setOption(credentials, domain, 'username', user);
    setOption(credentials, domain, 'password', token);
    setOption(credentials, domain, 'unsafe_hosts', 'true', unsafe);
}

exports.update = function update_config(data, config_forms) {
    const settings = exports.read('settings.cfg');

    replaceSection(settings, 'bigboat');
    setOption(settings, 'bigboat', 'host', data.bigboat_url);
    setOption(settings, 'bigboat', 'key', data.bigboat_key);

    replaceSection(settings, 'projects');
    var projects = typeof data.quality_report_name === "undefined" ?
        [{key: data.jira_key, value: ""}] : data.quality_report_name;
    if (projects[0].key === "") {
        projects[0].key = data.jira_key;
    }

    projects.forEach(function(project) {
        setOption(settings, 'projects', project.key, project.value);
    });

    replaceSection(settings, 'ssh');
    setOption(settings, 'ssh', 'username', 'agent-' + data.jira_key);
    setOption(settings, 'ssh', 'host', options.ssh_host);
    setOption(settings, 'ssh', 'cert', 'certs/wwwgros.crt');

    replaceSection(settings, 'jenkins');
    setOption(settings, 'jenkins', 'host', '');
    setOption(settings, 'jenkins', 'username', '');
    setOption(settings, 'jenkins', 'password', '');
    setOption(settings, 'jenkins', 'verify', '');

    settings.removeKey('definitions', 'name');
    if (data.quality_report_enable) {
        setOption(settings, 'definitions', 'name', 'quality-report-data');
    }

    replaceSection(settings, 'quality-time');
    if (data.quality_time_url) {
        setOption(settings, 'quality-time', 'name', 'quality-time-data');
        setOption(settings, 'quality-time', 'url', data.quality_time_url);
    }

    writeConfig(settings, 'settings.cfg');

    const keys = projects.map(function(project) {
        return project.key;
    }).join(' ');
    var env = `
JIRA_KEY="${keys}"
SSH_USERNAME=agent-${data.jira_key}
${projects[0].value === '' ? 'skip_dropin=0' : ''}`;
    var sources = [];

    const credentials = exports.read('credentials.cfg');
    credentials.sections().forEach(function(section) {
        credentials.removeSection(section);
    });

    [].concat(data.version_control_domain).forEach(function(domain, index) {
        env += "\n" + set_credentials(credentials, data, index, sources);
    });

    [].concat(data.jenkins_host).forEach(function(domain, index) {
        set_jenkins_credentials(credentials, data, index, sources);
    });

    writeConfig(credentials, 'credentials.cfg');

    fs.writeFileSync(path.join(options.config_path, 'env'), env);

    if (sources.length > 0 && projects.length === 1 &&
        projects[0].value === '' && exports.has_value(data.jira_key)
    ) {
        const export_project_path = path.join(options.export_path, data.jira_key);
        if (!fs.existsSync(export_project_path)) {
            fs.mkdirSync(export_project_path);
        }
        fs.writeFileSync(path.join(export_project_path, 'data_sources.json'),
            JSON.stringify(sources)
        );
    }

    console.log('Updated configuration');
};
