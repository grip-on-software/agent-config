/* Form building and input parsing. */
'use strict';

const fs = require('fs'),
      path = require('path'),
      forms = require('forms'),
      yaml = require('js-yaml'),
      config_has_value = require('./config').has_value,
      options = require('./options');

var fields = forms.fields,
    widgets = forms.widgets;

fields.plain_string = fields.string;
fields.string = function(opts) {
    opts.attrs = opts.attrs || {
        required: opts.required,
        placeholder: opts.placeholder
    };
    var f = fields.plain_string(opts);
    var parse = f.parse,
        bind = f.bind,
        classes = f.classes,
        toHTML = f.toHTML;
    f.parse = function(raw_data) {
        if (raw_data === '<existing>') {
            return this.original_value;
        }
        else {
            return parse.call(this, raw_data);
        }
    };
    f.bind = function(raw_data) {
        this.original_value = this.value;
        return bind.call(this, raw_data);
    };
    f.classes = function() {
        var r = classes.call(this);
        if (this.expand) {
            r.push('expand');
        }
        return r;
    };
    f.setValue = function(config_form, settings, credentials) {
        var optionData;
        if (this.option) {
            optionData = this.option;
        }
        if (this.getOption) {
            try {
                optionData = this.getOption(config_form, settings, credentials);
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
                    if (typeof section === "string") {
                        if (config.hasSection(section)) {
                            this.value = config.keys(section)[0];
                        }
                    }
                    else {
                        this.value = section.map(function(sect) {
                            if (!config.hasSection(sect)) {
                                return '';
                            }
                            return config.keys(sect).filter(config_has_value).join(' ');
                        }).join(' ').trim();
                    }
                }
                else {
                    option = optionData[2].split('.', 2);
                    this.value = config.get(section, (option.length > 1 ?
                        config_form.form[option[0]][option[1]].value : option[0]
                    ));
                }
            }
            catch (e) {
                console.log([e, section, option]);
            }
        }
        if (!config_has_value(this.value)) {
            this.value = '';
        }
    };
    f.toHTML = function(name, iterator) {
        var classes = 'hint' + (this.expand ? ' expand' : '');
        return toHTML.call(this, name, iterator) +
            `<div class="${classes}">` + (this.hint ? this.hint : '') +
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
    var w = widgets.text(opts);
    w.formatValue = function(value) {
        return (value || value === 0) ? '<existing>' : null;
    };
    return w;
};
widgets.plain_textarea = widgets.textarea;
widgets.textarea = function(options) {
    var w = widgets.plain_textarea(options);
    var toHTML = w.toHTML;
    w.attrs = {spellcheck: "false"};
    w.toHTML = function(name, field) {
        var f = field || {};
        var value = f.value;
        f.value = (f.value || f.value === 0) ? '<existing>' : '';
        var html = toHTML.call(this, name, field);
        f.value = value;
        return html;
    };
    return w;
};

function getVersionControlSection(config_form, credentials) {
    return credentials.sections()[config_form.sequence-1];
}
const version_control_options = {
    version_control_type: function(config_form, settings, credentials) {
        const section = getVersionControlSection(config_form, credentials);
        if (config_has_value(credentials.get(section, 'tfs'))) {
            return 'tfs';
        }
        if (config_has_value(credentials.get(section, 'gitlab_token')) ||
            config_has_value(credentials.get(section, 'group'))
        ) {
            return 'gitlab';
        }
        if (config_has_value(credentials.get(section, 'github_token'))) {
            return 'github';
        }
        if (config_has_value(credentials.get(section, 'env'))) {
            return 'git';
        }
        return 'subversion';
    },
    version_control_domain: function(config_form, settings, credentials) {
        return getVersionControlSection(config_form, credentials);
    },
    version_control_auth: function(config_form, settings, credentials) {
        const section = getVersionControlSection(config_form, credentials);
        if (config_has_value(credentials.get(section, 'github_token'))) {
            return 'github_api';
        }
        if (config_has_value(credentials.get(section, 'gitlab_token'))) {
            return 'gitlab_api';
        }
        if (config_has_value(credentials.get(section, 'env'))) {
            return 'deploy_key';
        }
        if (config_has_value(credentials.get(section, 'username'))) {
            return 'user_pass';
        }
        return 'none';
    },
    version_control_user: function(config_form, settings, credentials) {
        const section = getVersionControlSection(config_form, credentials);
        if (config_has_value(credentials.get(section, 'username'))) {
            return [credentials, section, 'username'];
        }
    },
    version_control_token: function(config_form, settings, credentials) {
        const section = getVersionControlSection(config_form, credentials);
        if (config_has_value(credentials.get(section, 'password'))) {
            return [credentials, section, 'password'];
        }
        if (config_has_value(credentials.get(section, 'github_token'))) {
            return [credentials, section, 'github_token'];
        }
        if (config_has_value(credentials.get(section, 'gitlab_token'))) {
            return [credentials, section, 'gitlab_token'];
        }
    },
    version_control_key: function(config_form, settings, credentials) {
        const section = getVersionControlSection(config_form, credentials);
        if (fs.existsSync(path.join(options.key_path, 'source_' + section))) {
            return '<existing>';
        }
        if (fs.existsSync(path.join(options.key_path, 'id_rsa'))) {
            return '<existing>';
        }
    },
    version_control_group: function(config_form, settings, credentials) {
        const section = getVersionControlSection(config_form, credentials);
        if (config_has_value(credentials.get(section, 'tfs'))) {
            return [credentials, section, 'tfs'];
        }
        if (config_has_value(credentials.get(section, 'group'))) {
            return [credentials, section, 'group'];
        }
    },
    version_control_unsafe: function(config_form, settings, credentials) {
        const section = getVersionControlSection(config_form, credentials);
        if (config_has_value(credentials.get(section, 'unsafe_hosts'))) {
            return '1';
        }
    },
    version_control_source: function(config_form, settings, credentials) {
        // Obtain the project key for the export path
        if (!settings.hasSection('projects')) {
            return '';
        }
        const jira_key = settings.keys('projects');
        if (jira_key.length == 0) {
            return '';
        }

        // If the main key has a configured quality report name, then the dummy
        // source is ignored.
        const main_key = jira_key.shift();
        if (config_has_value(settings.get('projects', main_key))) {
            return '';
        }

        // Obtain the dummy source from the export data.
        const sources_path = path.join(options.export_path, main_key,
                                       'data_sources.json');
        if (!fs.existsSync(sources_path)) {
            return '';
        }
        const sources = JSON.parse(fs.readFileSync(sources_path));
        const domain = getVersionControlSection(config_form, credentials);
        const source = sources.filter(function(source) {
            return source.name == `dummy repository on ${domain}`;
        }).shift();
        return source ? source.url : '';
    },
    version_control_from_date: function(config_form, settings, credentials) {
        const section = getVersionControlSection(config_form, credentials);
        return [credentials, section, 'from_date'];
    },
    version_control_tag: function(config_form, settings, credentials) {
        const section = getVersionControlSection(config_form, credentials);
        return [credentials, section, 'tag'];
    }
};

function create_forms(body, settings, credentials) {
    const form = yaml.safeLoad(fs.readFileSync(__dirname + '/../template/form.yml', 'utf-8'));

    function hasForm(formName, sequence) {
        if (body && formName + '_' + sequence in body) {
            return true;
        }
        else if (!body && formName === 'version_control') {
            return credentials.sections().length >= sequence;
        }
        return false;
    }

    function buildForm(formName) {
        var formFields = {};
        var formData = Object.assign({}, form[formName]);
        Object.keys(formData.fields).forEach(function(fieldName) {
            const data = Object.assign({}, formData.fields[fieldName]);
            if (data.widget) {
                data.widget = widgets[data.widget]();
            }
            if (formName === 'version_control') {
                data.getOption = version_control_options[fieldName];
            }
            var field = fields[data.field](data);
            formFields[fieldName] = field;
        });
        delete formData.fields;
        formData.form = forms.create(formFields);
        return formData;
    }

    var config_forms = [];
    Object.keys(form).forEach(function(formName) {
        var formData = buildForm(formName);
        if (formData.cloneable) {
            var sequence = 1;
            var more = true;
            while (more) {
                formData.id = formName + '_' + sequence;
                formData.sequence = sequence;
                config_forms.push(formData);
                sequence++;
                more = hasForm(formName, sequence);
                if (more) {
                    formData = buildForm(formName);
                }
            }
        }
        else {
            formData.id = formName;
            formData.sequence = 1;
            config_forms.push(formData);
        }
    });
    return config_forms;
}

module.exports = create_forms;
