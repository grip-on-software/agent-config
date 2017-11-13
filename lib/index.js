'use strict';

const fs = require('fs'),
      http = require('http'),
      parse = require('url').parse,
      util = require('util'),
      forms = require('forms'),
      configparser = require('config-ini-parser').ConfigIniParser,
      Mustache = require('Mustache');

// Templating
const page = fs.readFileSync(__dirname + '/../template/page.mustache').toString();

const fields = forms.fields,
      validators = forms.validators,
      widgets = forms.widgets;

var string = function(opts) {
    opts.attrs = opts.attrs || {
        required: opts.required,
        placeholder: opts.placeholder
    };
    var f = fields.string(opts);
    f.setValue = function(form, settings, credentials) {
        if (!this.getOption) {
            return;
        }
        try {
            var optionData = this.getOption(form, settings, credentials);
        }
        catch (e) {
            console.log(e);
            return;
        }
        if (typeof optionData !== "object") {
            this.value = optionData;
        }
        else {
            const config = optionData[0];
            const section = optionData[1];
            const option = optionData[2];
            try {
                this.value = config.get(section, option);
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
var password = function(opts) {
    var w = widgets.password(opts);
    w.formatValue = function(value) {
        return value;
    };
    return w;
};

const config_form = forms.create({
    bigboat_url: string({
        required: true,
        label: 'BigBoat URL',
        hint: 'The URL to the location of the BigBoat dashboard.',
        placeholder: 'http://bigboat.example',
        getOption: function(form, settings, credentials) {
            return [settings, 'bigboat', 'host'];
        }
    }),
    bigboat_key: string({
        required: true,
        label: 'BigBoat key',
        widget: password(),
        hint: 'An API key of the BigBoat dashboard.',
        longer_hint: "You can generate a new key on the dashboard's configuration page. Do not generate the API key while logged out. Any logged-in API key works.",
        getOption: function(form, settings, credentials) {
            return [settings, 'bigboat', 'key'];
        }
    }),
    jira_key: string({
        required: true,
        label: 'JIRA key prefix',
        placeholder: 'ABC',
        hint: 'The JIRA prefix used to identify issues in the JIRA board.',
        longer_hint: 'If you have issues like <samp>ABC-1234</samp>, then this is <kbd>ABC</kbd>. You can also find it on <a href="http://jira.example/jira/secure/BrowseProjects.jspa?selectedCategory=all&selectedProjectType=all">the Browse Projects</a> page where it is in the "Key" column. If you use multiple JIRA boards in your project (which share the same dashboard environment) then provide all of them, the main project key first.',
        getOption: function(form, settings, credentials) {
            return settings.options('projects')[0];
        }
    }),
    quality_report_name: string({
        required: true,
        label: 'Quality report name',
        placeholder: 'abc',
        hint: 'The name of the project used internally by the quality report dashboard.',
        longer_hint: 'Find the name on <a href="http://jenkins.example:8080/view/Quality%20reports/">the Quality reports view</a>; if you have a job name like <samp>quality-report-abc</samp> then this is <kdb>abc</kdb>.',
        getOption: function(form, settings, credentials) {
            return [settings, 'projects', form.fields.jira_key.value];
        }
    }),
    version_control_type: string({
        required: true,
        label: 'Version control type',
        choices: {
            git: 'Git',
            gitlab: 'GitLab',
            github: 'GitHub',
            tfs: 'Team Foundation Server',
            svn: 'Subversion'
        },
        widget: widgets.select(),
        hint: 'The type of version control system used.',
        longer_hint: 'For Git systems, we accept several flavors which provide us with richer data. Currently, only one source is accepted. If you use multiple version control systems, consider migrating them to one and provide the system with the most relevant source code.',
        getOption: function(form, settings, credentials) {
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
        }
    }),
    version_control_domain: string({
        required: true,
        label: 'Version control domain',
        placeholder: 'gitlab.example',
        hint: 'The domain name plus optional port number where the version control system is hosted.',
        longer_hint: 'For example <samp>gitlab.example</samp> or <samp>tfs.example:8080</samp>.',
        getOption: function(form, settings, credentials) {
            return credentials.sections()[0];
        }
    }),
    version_control_auth: string({
        required: true,
        label: 'Version control authentication',
        choices: {
            none: 'Anonymous checkout',
            github_api: 'GitHub API',
            gitlab_api: 'GitLab API',
            gitlab_deploy: 'GitLab deploy key',
            user_pass: 'Username and password'
        },
        widget: widgets.select(),
        hint: 'The authentication scheme to use when connecting to the version control system.',
        longer_hint: `<ul>
            <li>Anonymous checkout: generally not an acceptable method.</li>
            <li>GitHub API: Use the API to register a specific SSH token for a user.</li>
            <li>GitLab API: Use the API to register a specific SSH token for a user. This user needs at least Reporter level access permissions to the group. Generate an API token for this user on GitLab in the user's Settings, under Personal Access tokens. Use a descriptive name "GROS reporter" with no expiry for the "api" scope. Keep the username field in this form empty and provide the API token in the password field after that.</li>
            <li>GitLab deploy key: Administrator access to GitLab is required to register the deploy key pair. On Linux/Mac, use <kbd>ssh-keygen -t rsa -C "agent gitlab access" -b 4096 -f deploy_key</kbd> and press <kbd>Enter</kbd> twice to skip entering a passphrase (not supported at this moment). Insert the public part (found in <samp>deploy_key.pub</samp>) on GitLab in the Admin Area under Deploy Keys with a descriptive name <kbd>"GROS reporter"</kbd>, and without write access. Keep the next field empty and provide the contents of the private key (<samp>deploy_key</samp>) in the field after that.</li>
            <li>Username and password: Combination as used by TFS or Subversion. Provide the username and password in the next two fields.</li>
        </ul>`,
        getOption: function(form, settings, credentials) {
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
        }
    }),
    version_control_user: string({
        label: 'Version control username',
        hint: 'The username to login to the version control system with. Only used if the authentication is "Username and password".',
        getOption: function(form, settings, credentials) {
            const section = credentials.sections()[0];
            if (credentials.get(section, 'username') != '-') {
                return [credentials, section, 'username'];
            }
        }
    }),
    version_control_token: string({
        label: 'Version control authentication token',
        widget: password(),
        hint: 'The password, deploy key or API token to login to the version control system with.',
        getOption: function(form, settings, credentials) {
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
        }
    }),
    gitlab_group_name: string({
        label: 'GitLab group name',
        placeholder: 'abc',
        hint: 'The path name of the group on GitLab in which all the source code repositories are stored.',
        longer_hint: 'This is found under the Settings for the group on GitLab, with setting name "Group path". This is only necessary if the quality reporting dashboard has no metrics for the source code repository.',
        getOption: function(form, settings, credentials) {
            return [credentials, form.fields.version_control_domain.value, 'group'];
        }
    }),
    jenkins_host: string({
        label: 'Jenkins host',
        placeholdeR: 'http://jenkins.example:8080',
        hint: 'The protocol, domain name and optionally port number of the Jenkins instance used for automated builds of the application developed by the team.',
        longer_hint: 'Get this from the main page of Jenkins by clicking on the logo in the top left and then copying the resulting URL, for example <samp>http://jenkins.example:8080</samp>.',
        getOption: function(form, settings, credentials) {
            return [settings, 'jenkins', 'host'];
        }
    }),
    jenkins_user: string({
        label: 'Jenkins username',
        hint: 'The username to log in to Jenkins with. This is only necessary if Jenkins is completely restricted to logged-in users, since we only need read access.',
        getOption: function(form, settings, credentials) {
            return [settings, 'jenkins', 'username'];
        }
    }),
    jenkins_token: string({
        label: 'Jenkins token',
        widget: password(),
        hint: 'The password to log in to the Jenkins API with. This is only necessary if Jenkins is completely restricted to logged-in users.',
        longer_hint: 'Use an API token instead of the plain (LDAP) password. You can find the API token when you are logged in by clicking on your name in the top right, then Configure, and finally press <kbd><samp>Show API Token...</samp></kbd>',
        getOption: function(form, settings, credentials) {
            return [settings, 'jenkins', 'password'];
        }
    })
})

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
    config_form.handle(req, {
        success: function (form) {
            update_config(form.data);
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.write('<h1>Success!</h1>');
            res.end('<pre>' + util.inspect(form.data) + '</pre>');
        },
        other: function (form) {
            const settings = read_config('settings.cfg');
            const credentials = read_config('credentials.cfg');
            Object.keys(form.fields).forEach(function(k) {
                if (form.fields[k].setValue) {
                    form.fields[k].setValue(form, settings, credentials);
                }
            });
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(Mustache.render(page, {
                form: form.toHTML(),
                method: 'POST',
                enctype: 'multipart/form-data'
            }));
        }
    });

}).listen(8080);

console.log('Server running at http://127.0.0.1:8080/');
