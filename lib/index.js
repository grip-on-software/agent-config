'use strict';

const fs = require('fs'),
      http = require('http'),
      path = require('path'),
      parse = require('url').parse,
      util = require('util'),
      async = require('async'),
      forms = require('forms'),
      formidable = require('formidable'),
      querystring = require('qs'),
      configparser = require('config-ini-parser').ConfigIniParser,
      yaml = require('js-yaml'),
      Mustache = require('mustache');

// Templating
const page = fs.readFileSync(__dirname + '/../template/page.mustache').toString();
const form = yaml.safeLoad(fs.readFileSync(__dirname + '/../template/form.yml', 'utf-8'));

var fields = forms.fields,
    widgets = forms.widgets;

const config_path = 'CONFIG_PATH' in process.env ? process.env['CONFIG_PATH'] : '';
const key_path = 'IDENTITY_PATH' in process.env ? process.env['IDENTITY_PATH'] : '';

fields.plain_string = fields.string;
fields.string = function(opts) {
    opts.attrs = opts.attrs || {
        required: opts.required,
        placeholder: opts.placeholder
    };
    var f = fields.plain_string(opts);
    f.setValue = function(form, settings, credentials) {
        var optionData;
        if (this.option) {
            optionData = this.option;
        }
        if (this.getOption) {
            try {
                optionData = this.getOption(form, settings, credentials);
            }
            catch (e) {
                console.log(e);
                return;
            }
        }
        if (typeof optionData !== "object") {
            this.value = optionData;
        }
        else {
            const config = (typeof optionData[0] === "string" ?
                {
                    "settings": settings,
                    "credentials": credentials
                }[optionData[0]] :
                optionData[0]
            );
            const section = optionData[1];
            var option;
            try {
                if (optionData.length <= 2) {
                    this.value = config.options(section)[0];
                }
                else {
                    option = optionData[2].split('.', 2);
                    this.value = config.get(section, (option.length > 1 ?
                        form[option[0]][option[1]].value : option[0]
                    ));
                }
            }
            catch (e) {
                console.log([e, config.stringify(), section, option]);
            }
        }
    }
    var toHTML = f.toHTML;
    f.toHTML = function(name, iterator) {
        return toHTML.call(this, name, iterator) +
            '<div class="hint">' + (this.hint ? this.hint : '') +
                (this.longer_hint ?
                    '<div class="longer_hint">' + this.longer_hint + '</div>' :
                    ''
                ) +
            '</div>';
    };
    return f;
};
widgets.safe_password = widgets.password;
widgets.password = function(opts) {
    opts = opts || {};
    opts.autocomplete = opts.autocomplete || "off";
    var w = widgets.safe_password(opts);
    w.formatValue = function(value) {
        return value;
    };
    return w;
};

const falsy_values = new Set(['false', 'no', 'off', '-', '0', '', null, undefined]);
function config_has_value(value) {
    return !falsy_values.has(value);
}

const version_control_options = {
    version_control_type: function(form, settings, credentials) {
        const section = credentials.sections()[0];
        if (config_has_value(credentials.get(section, 'tfs'))) {
            return 'tfs';
        }
        if (config_has_value(credentials.get(section, 'group'))) {
            return 'gitlab';
        }
        if (config_has_value(credentials.get(section, 'github_token'))) {
            return 'github';
        }
        if (config_has_value(credentials.get(section, 'env'))) {
            return 'git';
        }
        return 'svn';
    },
    version_control_domain: function(form, settings, credentials) {
        return credentials.sections()[0];
    },
    version_control_auth: function(form, settings, credentials) {
        const section = credentials.sections()[0];
        if (config_has_value(credentials.get(section, 'username'))) {
            return 'user_pass';
        }
        if (config_has_value(credentials.get(section, 'github_token'))) {
            return 'github_api';
        }
        if (config_has_value(credentials.get(section, 'gitlab_token'))) {
            return 'gitlab_api';
        }
        return 'none';
    },
    version_control_user: function(form, settings, credentials) {
        const section = credentials.sections()[0];
        if (config_has_value(credentials.get(section, 'username'))) {
            return [credentials, section, 'username'];
        }
    },
    version_control_token: function(form, settings, credentials) {
        const section = credentials.sections()[0];
        if (config_has_value(credentials.get(section, 'password'))) {
            return [credentials, section, 'password'];
        }
        if (config_has_value(credentials.get(section, 'github_token'))) {
            return [credentials, section, 'github_token'];
        }
        if (config_has_value(credentials.get(section, 'gitlab_token'))) {
            return [credentials, section, 'gitlab_token'];
        }
        if (fs.existsSync(path.join(key_path, 'id_rsa'))) {
            return '<existing>';
        }
    },
    gitlab_group_name: function(form, settings, credentials) {
        return [credentials, form.fields.version_control_domain.value, 'group'];
    }
};

var config_forms = [];
Object.keys(form).forEach(function(formName) {
    var formFields = {};
    var formData = form[formName];
    Object.keys(formData.fields).forEach(function(fieldName) {
        const data = formData.fields[fieldName];
        if (data.widget) {
            data.widget = widgets[data.widget]();
        }
        if (formName == 'version_control') {
            data.getOption = version_control_options[fieldName];
        }
        var field = fields[data.field](data);
        formFields[fieldName] = field;
    });
    delete formData.fields;
    formData.form = forms.create(formFields);
    config_forms.push(formData);
});

function read_config(filename) {
    const config = new configparser();
    const file_path = path.join(config_path, filename);
    if (fs.existsSync(file_path)) {
        config.parse(fs.readFileSync(file_path).toString('utf-8'));
    }
    return config;
};
function update_config(data) {
    const replaceSection = function(config, section) {
        config.removeSection(section);
        config.addSection(section);
    };
    const setOption = function(config, section, option, value) {
        config.set(section, option, ' ' + value);
    };
    const writeConfig = function(config, filename) {
        const file_path = path.join(config_path, filename);
        fs.writeFileSync(file_path, config.stringify());
    };

    const settings = read_config('settings.cfg');

    replaceSection(settings, 'bigboat');
    setOption(settings, 'bigboat', 'host', data.bigboat_url);
    setOption(settings, 'bigboat', 'key', data.bigboat_key);

    var subproject_keys = data.jira_key.split(' ');
    const main_key = subproject_keys.shift();
    replaceSection(settings, 'projects');
    setOption(settings, 'projects', main_key, data.quality_report_name);

    replaceSection(settings, 'subprojects');
    subproject_keys.forEach(function(subproject_key) {
        setOption(settings, 'subprojects', subproject_key, main_key);
    });

    replaceSection(settings, 'jenkins');
    setOption(settings, 'jenkins', 'host', data.jenkins_host);
    setOption(settings, 'jenkins', 'username', data.jenkins_user);
    setOption(settings, 'jenkins', 'password', data.jenkins_token);

    writeConfig(settings, 'settings.cfg');

    const credentials = read_config('credentials.cfg');

    const domain = data.version_control_domain,
          auth = data.version_control_auth,
          vcs_type = data.version_control_type;
    replaceSection(credentials, domain);
    setOption(credentials, domain, 'env',
        (auth == 'user_pass' ? '-' : 'SSH_IDENITITY')
    );
    setOption(credentials, domain, 'username',
        (data.version_control_user !== '' ? data.version_control_user : '-')
    );
    setOption(credentials, domain, 'password',
        (auth == 'user_pass' ? data.version_control_token : '-')
    );
    setOption(credentials, domain, 'github_api_url', '-');
    setOption(credentials, domain, 'github_token',
        (auth == 'github_api' ? data.version_control_token : '-')
    );
    setOption(credentials, domain, 'github_bots', '-');
    setOption(credentials, domain, 'tfs', (vcs_type == 'tfs' ? 'true' : '-'));
    setOption(credentials, domain, 'gitlab_token',
        (auth == 'gitlab_api' ? data.version_control_token : '-')
    );
    setOption(credentials, domain, 'group',
        (vcs_type == 'gitlab' ? data.gitlab_group_name : '-')
    );
    if (auth == 'deploy_key' && data.version_control_token !== '' &&
        data.version_control_token !== '<existing>'
    ) {
        fs.writeFileSync('id_rsa', data.version_control_token);
    }

    writeConfig(credentials, 'credentials.cfg');

    console.log('Updated configuration');
}

function handleBody(body, res) {
    async.reduce(config_forms, {"success": [], "other": []}, 
        function(states, config_form, callback) {
            var form_body = config_form.cloneable && body ? body.something : body
            config_form.form.handle(form_body, {
                success: function(form) {
                    states.success.push(form);
                    callback(null, states);
                },
                other: function(form) {
                    states.other.push(form);
                    callback(null, states);
                }
            });
            return states;
        }, function(error, formStates) {
            if (!formStates.other.length) {
                var data = formStates.success.reduce(function(result, form) {
                    return Object.assign(result, form.data);
                }, {});
                update_config(data);
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.write('<h1>Success!</h1>');
                res.end(formStates.success.map(function(form) { return '<pre>' + util.inspect(form.data) + '</pre>'; }).join('\n'));
            }
            else {
                const settings = read_config('settings.cfg');
                const credentials = read_config('credentials.cfg');
                formStates.other.forEach(function(form) {
                    Object.keys(form.fields).forEach(function(k) {
                        if (form.fields[k].setValue) {
                            form.fields[k].setValue(form, settings, credentials);
                        }
                    });
                });
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(Mustache.render(page, {
                    form: config_forms.map(function(config_form) {
                        return '<div class="component">' +
                            '<div class="name">' + config_form.name + '</div>' +
                            (config_form.cloneable ?
                                `<div class="clone">
                                    <button class="add" type="button">+</button><button class="remove" type="button">-</button>
                                </div>` : '') +
                            config_form.form.toHTML(config_form.cloneable ? 'something' : void 0, forms.render.div) + '</div>';
                    }).join('\n'),
                    method: 'POST',
                    enctype: 'multipart/form-data'
                }));
            }
        }
    );
}

http.createServer(function (req, res) {
    if (req.method == 'POST') {
        if (req.body) {
            handleBody(req.body, res);
        }
        else {
            var form = new formidable.IncomingForm();
            form.parse(req, function (err, originalFields/* , files*/) {
                if (err) { throw err; }
                var parsedFields = querystring.parse(querystring.stringify(originalFields));
                handleBody(parsedFields, res);
            });
        }
    }
    else {
        handleBody(null, res);
    }
}).listen(8080);

console.log('Server running at http://127.0.0.1:8080/');
