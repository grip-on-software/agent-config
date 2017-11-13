'use strict';

const fs = require('fs'),
      http = require('http'),
      parse = require('url').parse,
      util = require('util'),
      forms = require('forms'),
      configparser = require('config-ini-parser').ConfigIniParser,
      yaml = require('js-yaml'),
      Mustache = require('Mustache');

// Templating
const page = fs.readFileSync(__dirname + '/../template/page.mustache').toString();
const form = yaml.safeLoad(fs.readFileSync(__dirname + '/../template/form.yml', 'utf-8'));

var fields = forms.fields,
    widgets = forms.widgets;

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

const version_control_options = {
    version_control_type: function(form, settings, credentials) {
        const section = credentials.sections()[0];
        if (credentials.get(section, 'tfs') === 'true') {
            return 'tfs';
        }
        if (credentials.get(section, 'group') !== '-') {
            return 'gitlab';
        }
        if (credentials.get(section, 'github_token') !== '-') {
            return 'github';
        }
        if (credentials.get(section, 'env') !== '-') {
            return 'git';
        }
        return 'svn';
    },
    version_control_domain: function(form, settings, credentials) {
        return credentials.sections()[0];
    },
    version_control_auth: function(form, settings, credentials) {
        const section = credentials.sections()[0];
        if (credentials.get(section, 'username') !== '-') {
            return 'user_pass';
        }
        if (credentials.get(section, 'github_token') !== '-') {
            return 'github_api';
        }
        if (credentials.get(section, 'gitlab_token') !== '-') {
            return 'gitlab_api';
        }
        return 'none';
    },
    version_control_user: function(form, settings, credentials) {
        const section = credentials.sections()[0];
        if (credentials.get(section, 'username') != '-') {
            return [credentials, section, 'username'];
        }
    },
    version_control_token: function(form, settings, credentials) {
        const section = credentials.sections()[0];
        if (credentials.get(section, 'password') != '-') {
            return [credentials, section, 'password'];
        }
        if (credentials.get(section, 'github_token') != '-') {
            return [credentials, section, 'github_token'];
        }
        if (credentials.get(section, 'gitlab_token') != '-') {
            return [credentials, section, 'gitlab_token'];
        }
    },
    gitlab_group_name: function(form, settings, credentials) {
        return [credentials, form.fields.version_control_domain.value, 'group'];
    }
};

var config_forms = [];
Object.keys(form).forEach(function(formName) {
    var formFields = {};
    Object.keys(form[formName]).forEach(function(fieldName) {
        const data = form[formName][fieldName];
        if (data.widget) {
            data.widget = widgets[data.widget]();
        }
        if (formName == 'version_control') {
            data.getOption = version_control_options[fieldName];
        }
        var field = fields[data.field](data);
        formFields[fieldName] = field;
    });
    config_forms.push(forms.create(formFields));
});

function read_config(filename) {
    const config = new configparser();
    if (fs.existsSync(filename)) {
        config.parse(fs.readFileSync(filename).toString('utf-8'));
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
        fs.writeFileSync(filename, config.stringify());
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
        (auth == 'user_pass' ? data.version_control_user : '-')
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

    writeConfig(credentials, 'credentials.cfg');
}

http.createServer(function (req, res) {
    const formStates = config_forms.reduce(function(states, config_form) {
        config_form.handle(req, {
            success: function(form) {
                states.success.push(form);
            },
            other: function(form) {
                states.other.push(form);
            }
        });
        return states;
    }, {"success": [], "other": []});
    if (!formStates.other.length) {
        //update_config(form.data);
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
            form: config_forms.map(function(form) {
                return '<div class="component">' + form.toHTML() + '</div>';
            }).join('\n'),
            method: 'POST',
            enctype: 'multipart/form-data'
        }));
    }
}).listen(8080);

console.log('Server running at http://127.0.0.1:8080/');
