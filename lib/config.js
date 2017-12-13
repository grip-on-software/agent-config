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

exports.read = function read_config(filename) {
    const config = new configparser();
    const file_path = path.join(options.config_path, filename);
    if (fs.existsSync(file_path)) {
        config.read(file_path);
    }
    return config;
};

exports.update = function update_config(data, config_forms) {
    function set_credentials(index, sources) {
        const domain = [].concat(data.version_control_domain)[index],
              auth = [].concat(data.version_control_auth)[index],
              vcs_type = [].concat(data.version_control_type)[index],
              user = [].concat(data.version_control_user)[index],
              token = [].concat(data.version_control_token)[index],
              key = [].concat(data.version_control_key)[index],
              group = [].concat(data.version_control_group)[index],
              source = [].concat(data.version_control_source)[index],
              unsafe = [].concat(data.version_control_unsafe)[index],
              from_date = [].concat(data.version_control_from_date)[index],
              tag = [].concat(data.version_control_tag)[index],
              original_domain = config_forms[1+index].form.fields.version_control_domain.original_value;

        credentials.removeSection(original_domain);
        replaceSection(credentials, domain);

        const credentials_env = (auth === 'user_pass' ? '-' :
            `SOURCE_${index}_CREDENTIALS_ENV`
        );
        setOption(credentials, domain, 'env', credentials_env);
        setOption(credentials, domain, 'username', (user !== '' ? user : '-'));
        setOption(credentials, domain, 'password',
            (['user_pass', 'deploy_key'].includes(auth) ? token : '-')
        );
        setOption(credentials, domain, 'github_api_url', '-');
        setOption(credentials, domain, 'github_token',
            (auth === 'github_api' ? token : '-')
        );
        setOption(credentials, domain, 'github_bots', '-');
        setOption(credentials, domain, 'tfs',
            (vcs_type == 'tfs' ? (group !== '' ? group : 'true') : '-')
        );
        setOption(credentials, domain, 'gitlab_token',
            (auth === 'gitlab_api' ? token : '-')
        );
        setOption(credentials, domain, 'group',
            (vcs_type === 'gitlab' ? group : '-')
        );
        setOption(credentials, domain, 'unsafe_hosts', (unsafe ? 'true' : '-'));
        setOption(credentials, domain, 'from_date', from_date);
        setOption(credentials, domain, 'tag', tag);

        var key_file = path.join(options.key_path, 'id_rsa');
        if (auth === 'deploy_key' && key !== '') {
            key_file = path.join(options.key_path, 'source_' + domain);
            if (key !== '<existing>') {
                fs.writeFileSync(key_file, key);
            }
        }

        const name = `dummy repository on ${domain}`;
        if (source !== '') {
            sources.push({
                "type": vcs_type,
                "url": source,
                "name": name
            });
        }
        else if (group !== '') {
            if (vcs_type === 'gitlab') {
                sources.push({
                    "type": "gitlab",
                    "url": `http://${domain}/${group}/${group}.git`,
                    "name": name
                });
            }
            else if (vcs_type === 'tfs') {
                sources.push({
                    "type": "tfs",
                    "url": `http://${domain}/${group}/_git/Dummy`,
                    "name": name
                });
            }
        }

        return (auth === 'user_pass' ? '' : `${credentials_env}=${key_file}`);
    }

    const replaceSection = function(config, section) {
        config.removeSection(section);
        config.addSection(section);
    };
    const setOption = function(config, section, option, value) {
        config.set(section, option, value);
    };
    const writeConfig = function(config, filename) {
        const file_path = path.join(options.config_path, filename);
        config.write(file_path);
    };

    const settings = exports.read('settings.cfg');

    replaceSection(settings, 'bigboat');
    setOption(settings, 'bigboat', 'host', data.bigboat_url);
    setOption(settings, 'bigboat', 'key', data.bigboat_key);

    var subproject_keys = data.jira_key.trim().split(' ');
    const main_key = subproject_keys.shift();
    replaceSection(settings, 'projects');
    setOption(settings, 'projects', main_key, data.quality_report_name);

    replaceSection(settings, 'ssh');
    setOption(settings, 'ssh', 'username', 'agent-' + main_key);
    setOption(settings, 'ssh', 'host', options.ssh_host);
    setOption(settings, 'ssh', 'cert', 'certs/wwwgros.crt');

    replaceSection(settings, 'subprojects');
    subproject_keys.forEach(function(subproject_key) {
        setOption(settings, 'subprojects', subproject_key, main_key);
    });

    replaceSection(settings, 'jenkins');
    setOption(settings, 'jenkins', 'host', data.jenkins_host);
    setOption(settings, 'jenkins', 'username', data.jenkins_user);
    setOption(settings, 'jenkins', 'password', data.jenkins_token);
    setOption(settings, 'jenkins', 'verify', '');

    writeConfig(settings, 'settings.cfg');

    var env = `
JIRA_KEY=${main_key}
SSH_USERNAME=agent-${main_key}
${data.quality_report_name === '' ? 'skip_dropin=0' : ''}`;
    var sources = [];

    const credentials = exports.read('credentials.cfg');

    if (typeof data.version_control_domain === "string") {
        env += "\n" + set_credentials(0, sources);
    }
    else {
        data.version_control_domain.forEach(function(domain, index) {
            env += "\n" + set_credentials(index, sources);
        });
    }

    writeConfig(credentials, 'credentials.cfg');

    fs.writeFileSync(path.join(options.config_path, 'env'), env);

    if (sources.length > 0 && data.quality_report_name === '' &&
        exports.has_value(main_key)
    ) {
        const export_project_path = path.join(options.export_path, main_key);
        if (!fs.existsSync(export_project_path)) {
            fs.mkdirSync(export_project_path);
        }
        fs.writeFileSync(path.join(export_project_path, 'data_sources.json'),
            JSON.stringify(sources)
        );
    }

    console.log('Updated configuration');
};
