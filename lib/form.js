/**
 * Form building and input parsing.
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
      URL = require('url').URL,
      forms = require('forms'),
      yaml = require('js-yaml'),
      _ = require('lodash'),
      Mustache = require('mustache'),
      config = require('./config'),
      options = require('./options');

const FORM_COMPONENT = fs.readFileSync(`${__dirname}/../template/form_component.mustache`).toString();

var fields = forms.fields,
    widgets = forms.widgets;

function render(item) {
    return Mustache.render(item, options);
}

function getHintHTML(field) {
    var classes = 'hint';
    if (field.expand) {
        classes += ' expand';
    }
    const hint = (field.hint ? render(field.hint) : '');
    const longerHint = (field.longer_hint ?
        `<div class="longer_hint">${render(field.longer_hint)}</div>` : ''
    );
    return `<div class="${classes}">${hint}${longerHint}</div>`;
}

function getDomain(value) {
    try {
        const host = (new URL(value)).host;
        return host !== '' ? host : value;
    }
    catch (error) {
        return value;
    }
}

function getSectionValue(section, config) {
    if (typeof section === "string") {
        if (config.hasSection(section)) {
            return config.keys(section)[0];
        }
        return '';
    }
    return section.map(function(sect) {
        if (!config.hasSection(sect)) {
            return '';
        }
        return config.keys(sect).filter(config.has_value).join(' ');
    }).join(' ').trim();
}

function getOptionValue(optionData, configForm, settings, credentials) {
    if (optionData.length === 0) {
        return '';
    }
    const configuration = (typeof optionData[0] === "string" ?
        {
            "settings": settings,
            "credentials": credentials
        }[optionData[0]] :
        optionData[0]
    );
    const section = optionData[1];
    var option;
    try {
        return configuration.get(section, optionData[2]);
    }
    catch (e) {
        console.log([e, section, option]);
    }
    return '';
}

fields.plain_string = fields.string;
fields.string = function(opts) {
    const placeholder = opts.placeholder ? render(opts.placeholder) : null;
    opts.attrs = opts.attrs || {
        required: opts.required,
        placeholder: placeholder
    };
    var f = fields.plain_string(opts);
    var bind = f.bind,
        classes = f.classes,
        toHTML = f.toHTML;
    f.bind = function(rawData) {
        this.original_value = this.value;
        return bind.call(this, rawData);
    };
    f.classes = function() {
        var r = classes.call(this);
        if (this.expand) {
            r.push('expand');
        }
        return r;
    };

    f.setValue = function(configForm, settings, credentials) {
        var optionData = this.option;
        if (this.getOption) {
            try {
                optionData = this.getOption(configForm, settings, credentials);
            }
            catch (e) {
                console.log(e);
                return;
            }
        }
        this.value = optionData;
        if (typeof optionData === "object") {
            this.value = getOptionValue(optionData, configForm, settings,
                credentials
            );
        }
        if (!config.has_value(this.value)) {
            this.value = '';
        }
    };
    f.toHTML = function(name, iterator) {
        return toHTML.call(this, name, iterator) + getHintHTML(this);
    };
    return f;
};
fields.host = function(opts) {
    var f = fields.string(opts);
    var parse = f.parse;
    f.parse = function(rawData) {
        return getDomain(parse(rawData));
    };
    return f;
};
fields.map = function(opts) {
    const component = buildForm({map: opts}, 'map', opts.validators, 'item');
    var f = component.form;
    var toHTML = f.toHTML;
    var bind = f.bind;
    f.items = [f.fields];
    f.bind = function(data) {
        f.setData(data);
        const fields = f.fields;
        var bound = _.reduce(f.items, function(accumulator, item, index) {
            f.fields = item;
            var b = bind(_.mapValues(data, function(fieldData) {
                return _.isArray(fieldData) ? fieldData[index] : fieldData;
            }));
            f.fields = fields;

            _.assign(accumulator.fields, b.fields);
            accumulator.data.push(b.data);
            accumulator.binds.push(b);
            return accumulator;
        }, {
            toHTML: f.toHTML,
            fields: {},
            data: [],
            binds: []
        });
        bound.validate = function() {
            const args = arguments;
            _.every(bound.binds, function(bind) {
                bind.validate.apply(bind, args);
            });
        };
        bound.isValid = function() {
            return _.every(bound.binds, function(bind, index) {
                f.fields = f.items[index];
                const valid = bind.isValid();
                f.fields = fields;
                return valid;
            });
        };
        return bound;
    };
    f.setData = function(data) {
        var numItems = 0;
        if (!_.isEmpty(data)) {
            const first = _.first(_.values(data));
            numItems = typeof first === "string" ? 1 : first.length;
        }
        while (f.items.length < numItems) {
            const form = buildForm({map: opts}, 'map', opts.validators, 'item');
            f.items.push(form.form.fields);
        }
        f.value = data;
        f.data = data;
    };
    f.setValue = function(configForm, settings, credentials) {
        if (opts.getOption) {
            try {
                const data = opts.getOption(configForm, settings, credentials);
                f.setData(data);
                _.each(data, function(item, k) {
                    _.each(f.items, function(items, index) {
                        items[k].value = item[index];
                    });
                });
            }
            catch (e) {
                console.log(e);
                return;
            }
        }
    };
    f.classes = function() {
        var r = ['field', 'map'];
        if (opts.expand) {
            r.push('expand');
        }
        if (opts.cloneable) {
            r.push('cloneable');
        }
        return r;
    };
    f.labelHTML = function(name, id) {
        var forID = id === false ? false : (id || `id_${name}`);
        return widgets.label({
            classes: [],
            content: opts.label
        }).toHTML(forID, f);
    };
    f.errorHTML = function() {
        return '';
    };
    f.widget = {
        type: 'map',
        toHTML: function(name, field) {
            const fields = f.fields;
            return _.join(_.map(f.items, function(item, index) {
                f.fields = item;
                const html = Mustache.render(FORM_COMPONENT, _.assign({},
                    component, {
                        id: `${name}_${index + 1}`,
                        name: '',
                        cloneable: opts.cloneable,
                        sequence: index + 1,
                        remove: f.items.length === 1 ? "disabled" : "",
                        component: toHTML.call(f,
                            opts.cloneable ? `${name}_${index + 1}` : name,
                            forms.render.div
                        )
                    })
                );
                f.fields = fields;
                return html;
            }), '\n');
        }
    };
    f.toHTML = function(name, iterator) {
        return (iterator || forms.render.div)(name || this.name, this, opts) +
            getHintHTML(opts);
    };
    return f;
};
widgets.safe_password = widgets.password;
widgets.password = function(opts) {
    opts = opts || {};
    opts.autocomplete = opts.autocomplete || "off";
    var w = widgets.text(opts);
    w.formatValue = function(value) {
        return (value || value === 0) ? config.existing_value : null;
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
        f.value = (f.value || f.value === 0) ? config.existing_value : '';
        var html = toHTML.call(this, name, field);
        f.value = value;
        return html;
    };
    return w;
};

function getCredentialsSection(configForm, credentials, key=null) {
    if (key !== null && configForm.form.data) {
        // Set an original value of a password/token using credentials section
        // of the current domain to avoid detecting this as a token from
        // a different credentials section if order got changed.
        const domain = configForm.form.data[key];
        if (credentials.hasSection(domain)) {
            return domain;
        }
    }
    return credentials.sections()[configForm.cloneIndex-1];
}
const FORM_OPTIONS = {
    jira_key: function(configForm, settings, credentials) {
        return settings.hasSection('projects') ? settings.keys('projects')[0] : '';
    },
    quality_report_name: function(configForm, settings, credentials) {
        if (!settings.hasSection('projects')) {
            return {key: '', value: ''};
        }
        const keys = settings.keys('projects');
        const values = keys.map(function(key) {
            return settings.get('projects', key);
        });
        return {key: keys, value: values};
    },
    quality_report_enable: function(configForm, settings, credentials) {
        return settings.hasKey('definitions', 'name') ? '1' : '';
    },
    version_control_type: function(configForm, settings, credentials) {
        const section = getCredentialsSection(configForm, credentials);
        const type = credentials.get(section, 'type');
        if (config.has_value(type)) {
            return type;
        }
        if (config.has_value(credentials.get(section, 'tfs'))) {
            return 'tfs';
        }
        if (config.has_value(credentials.get(section, 'gitlab_token')) ||
            config.has_value(credentials.get(section, 'group'))
        ) {
            return 'gitlab';
        }
        if (config.has_value(credentials.get(section, 'github_token'))) {
            return 'github';
        }
        if (config.has_value(credentials.get(section, 'env'))) {
            return 'git';
        }
        return 'subversion';
    },
    version_control_domain: function(configForm, settings, credentials) {
        return getCredentialsSection(configForm, credentials);
    },
    version_control_auth: function(configForm, settings, credentials) {
        const section = getCredentialsSection(configForm, credentials);
        if (config.has_value(credentials.get(section, 'github_token'))) {
            return 'github_api';
        }
        if (config.has_value(credentials.get(section, 'gitlab_token'))) {
            return 'gitlab_api';
        }
        if (config.has_value(credentials.get(section, 'env'))) {
            return 'deploy_key';
        }
        if (config.has_value(credentials.get(section, 'username'))) {
            return 'user_pass';
        }
        return 'none';
    },
    version_control_user: function(configForm, settings, credentials) {
        const section = getCredentialsSection(configForm, credentials);
        if (config.has_value(credentials.get(section, 'username'))) {
            return [credentials, section, 'username'];
        }
        return [];
    },
    version_control_token: function(configForm, settings, credentials) {
        const section = getCredentialsSection(configForm, credentials,
            "version_control_domain"
        );
        if (config.has_value(credentials.get(section, 'password'))) {
            return [credentials, section, 'password'];
        }
        if (config.has_value(credentials.get(section, 'github_token'))) {
            return [credentials, section, 'github_token'];
        }
        if (config.has_value(credentials.get(section, 'gitlab_token'))) {
            return [credentials, section, 'gitlab_token'];
        }
        return [];
    },
    version_control_key: function(configForm, settings, credentials) {
        const section = getCredentialsSection(configForm, credentials,
            "version_control_domain"
        );
        if (fs.existsSync(path.join(options.key_path, `source_${section}`))) {
            return config.existing_value;
        }
        if (fs.existsSync(path.join(options.key_path, 'id_rsa'))) {
            return config.existing_value;
        }
        return '';
    },
    version_control_group: function(configForm, settings, credentials) {
        const section = getCredentialsSection(configForm, credentials);
        const tfsGroup = credentials.get(section, 'tfs');
        if (config.has_value(tfsGroup)) {
            return tfsGroup === 'true' ? [] : [credentials, section, 'tfs'];
        }
        if (config.has_value(credentials.get(section, 'group'))) {
            return [credentials, section, 'group'];
        }
        return [];
    },
    version_control_unsafe: function(configForm, settings, credentials) {
        const section = getCredentialsSection(configForm, credentials);
        if (config.has_value(credentials.get(section, 'unsafe_hosts'))) {
            return '1';
        }
        return '';
    },
    version_control_skip_stats: function(configForm, settings, credentials) {
        const section = getCredentialsSection(configForm, credentials);
        if (config.has_value(credentials.get(section, 'skip_stats'))) {
            return '1';
        }
        return '';
    },
    version_control_source: function(configForm, settings, credentials) {
        // Obtain the project key for the export path
        if (!settings.hasSection('projects')) {
            return {};
        }
        const jiraKey = settings.keys('projects');
        if (jiraKey.length === 0) {
            return {};
        }

        // If the main key has a configured quality report name, then the file
        // with the dummy source (or indeed the collected sources) is ignored.
        const mainKey = jiraKey.shift();
        if (config.has_value(settings.get('projects', mainKey))) {
            return {};
        }

        // Obtain the dummy source from the export data file.
        const sourcesPath = path.join(options.export_path, mainKey,
                                      'data_sources.json');
        if (!fs.existsSync(sourcesPath)) {
            return {};
        }
        const sources = JSON.parse(fs.readFileSync(sourcesPath));
        const domain = getCredentialsSection(configForm, credentials);
        const prefix = 'dummy';
        return sources.filter(function(source) {
            return source.name.startsWith(prefix) &&
                source.name.endsWith(domain);
        }).reduce(function(accumulator, source) {
            const key = source.name.substring(prefix.length + 1,
                source.name.length - domain.length - 1
            );
            accumulator.key.push(key === "repository on" ? "" : key);
            accumulator.value.push(source.url);
            return accumulator;
        }, {key: [], value: []});
    },
    version_control_from_date: function(configForm, settings, credentials) {
        const section = getCredentialsSection(configForm, credentials);
        return [credentials, section, 'from_date'];
    },
    version_control_tag: function(configForm, settings, credentials) {
        const section = getCredentialsSection(configForm, credentials);
        return [credentials, section, 'tag'];
    },
    jenkins_host: function(configForm, settings, credentials) {
        const section = getCredentialsSection(configForm, credentials);
        if (!section) {
            return getDomain(settings.get('jenkins', 'host'));
        }
        return section;
    },
    jenkins_user: function(configForm, settings, credentials) {
        const section = getCredentialsSection(configForm, credentials);
        if (!section) {
            return [settings, 'jenkins', 'username'];
        }
        return [credentials, section, 'username'];
    },
    jenkins_token: function(configForm, settings, credentials) {
        const section = getCredentialsSection(configForm, credentials,
            "jenkins_host"
        );
        if (!section) {
            return [settings, 'jenkins', 'password'];
        }
        return [credentials, section, 'password'];
    },
    jenkins_unsafe: function(configForm, settings, credentials) {
        const section = getCredentialsSection(configForm, credentials);
        if (!section) {
            const value = settings.get('jenkins', 'host');
            if (config.has_value(settings.get('jenkins', 'verify')) ||
                typeof value === "undefined" || value.startsWith('http://')
            ) {
                return '';
            }
            return '1';
        }
        if (config.has_value(credentials.get(section, 'unsafe_hosts'))) {
            return '1';
        }
        return '';
    },
};

function buildForm(form, formName, validator, className='component') {
    var formFields = {};
    var formData = Object.assign({}, form[formName]);
    if (typeof validator === "function") {
        validator = [validator(formData)];
    }
    Object.keys(formData.fields).forEach(function(fieldName) {
        const data = Object.assign({}, formData.fields[fieldName]);
        if (data.widget) {
            data.widget = widgets[data.widget]();
        }
        if (FORM_OPTIONS[fieldName]) {
            data.getOption = FORM_OPTIONS[fieldName];
        }
        data.validators = validator;
        var field = fields[data.field](data);
        formFields[fieldName] = field;
    });
    delete formData.fields;
    formData.form = forms.create(formFields);
    formData.class = className;
    return formData;
}

function create_forms(body, settings, credentials) {
    const form = yaml.load(fs.readFileSync(`${__dirname}/../template/form.yml`, 'utf-8'));

    const vcsTypes = new Set(
        Object.keys(form.version_control.fields.version_control_type.choices)
    );
    vcsTypes.add(undefined);
    function hasForm(formName, sequence, index) {
        if (body) {
            return `${formName}_${sequence}` in body;
        }
        else if (formName === 'version_control') {
            const section = credentials.sections()[index-1];
            return section && vcsTypes.has(credentials.get(section, 'type'));
        }
        else if (formName === 'jenkins') {
            const section = credentials.sections()[index-1];
            return section && credentials.get(section, 'type') === 'jenkins';
        }

        return false;
    }

    const validator = function(configForm) {
        return function(form, field, callback) {
            if (field.data === config.existing_value) {
                configForm.form = form;
                field.setValue(configForm, settings, credentials);
                field.data = field.value === config.existing_value ?
                    field.original_value : field.value;
                form.data[field.name] = field.data;
            }
            callback();
        };
    };

    var configForms = [];
    var cloneIndex = 1;
    Object.keys(form).forEach(function(formName) {
        var formData = buildForm(form, formName, validator);
        if (formData.cloneable) {
            var sequence = 1;
            var more = true;
            while (more) {
                formData.id = `${formName}_${sequence}`;
                formData.body = body ? body[formData.id] : body;
                formData.sequence = sequence;
                formData.cloneIndex = cloneIndex;
                formData.remove = "";
                configForms.push(formData);
                sequence++;
                cloneIndex++;
                more = hasForm(formName, sequence, cloneIndex);
                if (more) {
                    formData = buildForm(form, formName, validator);
                }
            }
        }
        else {
            formData.id = formName;
            formData.body = body ? body[formData.id] : body;
            formData.sequence = 1;
            formData.cloneIndex = 1;
            formData.remove = "";
            configForms.push(formData);
        }
    });
    return configForms;
}

module.exports = create_forms;
