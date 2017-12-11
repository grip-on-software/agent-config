/* jshint node: true */
'use strict';

const fs = require('fs'),
      http = require('http'),
      https = require('https'),
      path = require('path'),
      parse = require('url').parse,
      util = require('util'),
      async = require('async'),
      express = require('express'),
      serveIndex = require('serve-index'),
      forms = require('forms'),
      formidable = require('formidable'),
      moment = require('moment'),
      querystring = require('qs'),
      configparser = require('configparser'),
      yaml = require('js-yaml'),
      Mustache = require('mustache'),
      _ = require('lodash');

// Templating
const head_partial = fs.readFileSync(__dirname + '/../template/head.mustache').toString();
const index_page = fs.readFileSync(__dirname + '/../template/index.mustache').toString();
const form_page = fs.readFileSync(__dirname + '/../template/form.mustache').toString();
const success_page = fs.readFileSync(__dirname + '/../template/success.mustache').toString();
const form = yaml.safeLoad(fs.readFileSync(__dirname + '/../template/form.yml', 'utf-8'));

var fields = forms.fields,
    widgets = forms.widgets;

const export_path = 'EXPORT_PATH' in process.env ? process.env.EXPORT_PATH : '';
const config_path = 'CONFIG_PATH' in process.env ? process.env.CONFIG_PATH : '';
const key_path = 'IDENTITY_PATH' in process.env ? process.env.IDENTITY_PATH : '';
const listen_address = 'LISTEN_ADDR' in process.env ? process.env.LISTEN_ADDR : '127.0.0.1';
const ssh_host = 'SSH_HOST' in process.env ? process.env.SSH_HOST : 'www.gros.example';

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
                        this.value = config.keys(section)[0];
                    }
                    else {
                        this.value = section.map(function(sect) {
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

const falsy_values = new Set(['false', 'no', 'off', '-', '0', '', null, undefined]);
function config_has_value(value) {
    return !falsy_values.has(value);
}

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
        const section = credentials.sections()[0];
        if (fs.existsSync(path.join(key_path, 'source_' + section))) {
            return '<existing>';
        }
        if (fs.existsSync(path.join(key_path, 'id_rsa'))) {
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
        const jira_key = settings.keys('projects');
        if (jira_key.length == 0) {
            return '';
        }
        const main_key = jira_key.shift();
        if (config_has_value(settings.get('projects', main_key))) {
            return '';
        }
        const sources_path = path.join(export_path, main_key,
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

function createForms(body, settings, credentials) {
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

function read_config(filename) {
    const config = new configparser();
    const file_path = path.join(config_path, filename);
    if (fs.existsSync(file_path)) {
        config.read(file_path);
    }
    return config;
}
function update_config(data, config_forms) {
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

        var key_file = path.join(key_path, 'id_rsa');
        if (auth === 'deploy_key' && key !== '') {
            key_file = path.join(key_path, 'source_' + domain);
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
        const file_path = path.join(config_path, filename);
        config.write(file_path);
    };

    const settings = read_config('settings.cfg');

    replaceSection(settings, 'bigboat');
    setOption(settings, 'bigboat', 'host', data.bigboat_url);
    setOption(settings, 'bigboat', 'key', data.bigboat_key);

    var subproject_keys = data.jira_key.trim().split(' ');
    const main_key = subproject_keys.shift();
    replaceSection(settings, 'projects');
    setOption(settings, 'projects', main_key, data.quality_report_name);

    replaceSection(settings, 'ssh');
    setOption(settings, 'ssh', 'username', 'agent-' + main_key);
    setOption(settings, 'ssh', 'host', ssh_host);
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

    const credentials = read_config('credentials.cfg');

    if (typeof data.version_control_domain === "string") {
        env += "\n" + set_credentials(0, sources);
    }
    else {
        data.version_control_domain.forEach(function(domain, index) {
            env += "\n" + set_credentials(index, sources);
        });
    }

    writeConfig(credentials, 'credentials.cfg');

    fs.writeFileSync(path.join(config_path, 'env'), env);

    if (sources.length > 0 && data.quality_report_name === '' &&
        config_has_value(main_key)
    ) {
        const export_project_path = path.join(export_path, main_key);
        if (!fs.existsSync(export_project_path)) {
            fs.mkdirSync(export_project_path);
        }
        fs.writeFileSync(path.join(export_project_path, 'data_sources.json'),
            JSON.stringify(sources)
        );
    }

    console.log('Updated configuration');
}

function handleBody(body, res) {
    const settings = read_config('settings.cfg');
    const credentials = read_config('credentials.cfg');

    var config_forms = createForms(body, settings, credentials);
    config_forms.forEach(function(config_form) {
        const fields = config_form.form.fields;
        Object.keys(fields).forEach(function(k) {
            if (fields[k].setValue) {
                fields[k].setValue(config_form, settings, credentials);
            }
        });
    });
    async.reduce(config_forms, {"success": [], "other": []}, 
        function(states, config_form, callback) {
            var form_body = config_form.cloneable && body ? body[config_form.id] : body;
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
                    return _.mergeWith(result, form.data, function(obj, src) {
                        if (typeof obj === "undefined") {
                            return src;
                        }
                        else if (typeof obj === "object") {
                            return obj.concat(src);
                        }
                        return [obj, src];
                    });
                }, {});
                update_config(data, config_forms);
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(Mustache.render(success_page, {
                    title: 'Success',
                    config_url: config_path !== '' ? '/config' : false
                }, {head: head_partial}));
            }
            else {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(Mustache.render(form_page, {
                    title: 'Agent configuration',
                    form: config_forms.map(function(config_form) {
                        var sequence = config_form.cloneable ?
                            `<span class="sequence">(${config_form.sequence})</span>` : '';
                        var clone = config_form.cloneable ?
                            `<div class="clone">
                                <button class="add" type="button">+</button><button class="remove" type="button">-</button>
                            </div>` : '';
                        var icon = config_form.icon ?
                            `<i class="fa fa-${config_form.icon}"></i>` : '';
                        return `<div class="component" id="${config_form.id}">
                            <div class="name">${icon} ${config_form.name} ${sequence}</div>
                            ${clone}
                            ${config_form.form.toHTML(config_form.cloneable ? config_form.id : void 0, forms.render.div)}
                        </div>`;
                    }).join('\n'),
                    method: 'POST',
                    enctype: 'multipart/form-data'
                }, {head: head_partial}));
            }
        }
    );
}

var app = express();
if (app.get('env') === 'dev-sync') {
    var browserSync = require('browser-sync');
    var bs = browserSync.create();
    bs.init({ logSnippet: false }, bs.reload);
    bs.watch("**/*.css").on("change", function() { bs.reload("*.css"); });
    bs.watch("**/*.js").on("change", function() { bs.reload("*.js"); });
    app.use(require('connect-browser-sync')(bs));
}

app.get('/', function(req, res) {
    const config_ok = fs.existsSync(path.join(config_path, 'settings.cfg'));
    const version_file = path.join(config_path, 'VERSION');
    var scrape_date = null;
    if (config_ok) {
        const settings = read_config('settings.cfg'),
              project_key = settings.keys('projects')[0],
              scrape_file = path.join(export_path, project_key, 'preflight_date.txt');
        scrape_date = fs.existsSync(scrape_file) ?
            moment(fs.readFileSync(scrape_file), "YYYY-MM-DD HH:mm:ss") : null;
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(Mustache.render(index_page, {
        title: 'Agent status',
        status_text: config_ok ? 'All good' : 'Not configured',
        status_class: config_ok ? 'ok' : 'fail',
        version: fs.existsSync(version_file) ? fs.readFileSync(version_file) : 'unknown',
        ssh_host: config_has_value(ssh_host) ? ssh_host : false,
        scrape_date: scrape_date ? `<span class="time" title="${scrape_date.format()}">${scrape_date.fromNow()}</span>` : '<span class="time-never">Never</span>',
        export_url: export_path !== '' ? '/export' : false
    }, {head: head_partial}));
});

app.get('/edit', function(req, res) {
    handleBody(null, res);
});
app.post('/edit', function(req, res) {
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
});

function setRequestTimeout(res, upstreamReq, timeout, onReject) {
    upstreamReq.setTimeout(timeout, function() {
        res.writeHead(500);
        res.end(JSON.stringify(onReject('Connection to the upstream server timed out')));
    }).on('error', function(e) {
        res.writeHead(500);
        res.end(JSON.stringify(onReject(e.message)));
    });
}

function channelJSON(res, upstreamRes, expectedCode, onReject) {
    upstreamRes.on('error', function(e) {
        res.writeHead(500);
        res.end(JSON.stringify(onReject(e.message)));
    });
    var message = '';
    if (upstreamRes.statusCode == expectedCode) {
        upstreamRes.on('data', function(chunk) {
            res.write(chunk);
        });
    }
    else {
        upstreamRes.on('data', function(chunk) {
            message += chunk;
        });
    }
    upstreamRes.on('end', function() {
        res.end(upstreamRes.statusCode === expectedCode ? '' :
            JSON.stringify(onReject(message.trim()))
        );
    });
}

app.use('/scrape', function(req, res) {
    res.setHeader("Content-Type", "application/json");
    var onReject = function(error) {
        return {
            'ok': false,
            'error': {
                'message': error
            }
        };
    };
    const upstreamReq = http.request({
        hostname: 'agent',
        port: 7070,
        method: 'POST',
        path: '/scrape'
    }, function(upstreamRes) {
        channelJSON(res, upstreamRes, 201, onReject);
    });
    setRequestTimeout(res, upstreamReq, 1000, onReject);
    upstreamReq.end();
});

app.use('/update', function(req, res) {
    res.setHeader("Content-Type", "application/json");
    if (!config_has_value(ssh_host)) {
        res.writeHead(500);
        res.end(JSON.stringify({
            up_to_date: false,
            message: "No controller host configured"
        }));
        return;
    }

    const version_file = path.join(config_path, 'VERSION');
    if (!fs.existsSync(version_file)) {
        res.writeHead(500);
        res.end(JSON.stringify({
            up_to_date: false,
            message: "No version known"
        }));
        return;
    }

    const version = fs.readFileSync(version_file).toString().trim();
    var onReject = function(error) {
        return {
            up_to_date: false,
            message: error
        };
    };
    const upstreamReq = https.get({
        hostname: ssh_host,
        port: 443,
        path: `/auth/version.py?${querystring.stringify({version: version})}`,
        rejectUnauthorized: false
    }, function(upstreamRes) {
        channelJSON(res, upstreamRes, 200, onReject);
    });
    setRequestTimeout(res, upstreamReq, 2000, onReject);
});

const index_config = {icons: true};
const static_config = {
    setHeaders: function(res, path) {
        res.setHeader("Content-Type", "text/plain");
        res.setHeader("Content-Disposition", "inline");
    }
};
if (export_path !== '') {
    app.use('/export', express.static(export_path, static_config),
        serveIndex(export_path, index_config)
    );
}
if (config_path !== '') {
    app.use('/config', express.static(config_path, static_config),
        serveIndex(config_path, index_config)
    );
}

app.use('/res', express.static(__dirname + '/../res/'));
app.use('/jquery', express.static(__dirname + '/../node_modules/jquery/dist/'));
app.use('/font-awesome', express.static(__dirname + '/../node_modules/font-awesome/'));

app.listen(8080, listen_address);

console.log('Server running at http://' + listen_address + ':8080/');
