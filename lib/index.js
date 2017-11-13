'use strict';

const fs = require('fs'),
      http = require('http'),
      parse = require('url').parse,
      util = require('util'),
      forms = require('forms'),
      configparser = require('configparser'),
      Mustache = require('Mustache');

// Templating
const page = fs.readFileSync(__dirname + '/../template/page.mustache').toString();

const fields = forms.fields,
      validators = forms.validators,
      widgets = forms.widgets;

var string = function(opts) {
    var f = fields.string(opts);
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

const config_form = forms.create({
    bigboat_url: string({
        required: true,
        label: 'BigBoat URL',
        hint: 'The URL to the location of the BigBoat dashboard.'
    }),
    bigboat_key: string({
        required: true,
        label: 'BigBoat key',
        hint: 'An API key of the BigBoat dashboard.',
        longer_hint: "You can generate a new key on the dashboard's configuration page. Do not generate the API key while logged out. Any logged-in API key works."
    }),
    jira_key: string({
        required: true,
        label: 'JIRA key prefix',
        hint: 'The JIRA prefix used to identify issues in the JIRA board.',
        longer_hint: 'If you have issues like <samp>ABC-1234</samp>, then this is <kbd>ABC</kbd>. You can also find it on <a href="http://jira.example/jira/secure/BrowseProjects.jspa?selectedCategory=all&selectedProjectType=all">the Browse Projects</a> page where it is in the "Key" column. If you use multiple JIRA boards in your project (which share the same dashboard environment) then provide all of them, the main project key first.'
    }),
    quality_report_name: string({
        required: true,
        label: 'Quality report name',
        hint: 'The name of the project used internally by the quality report dashboard.',
        longer_hint: 'Find the name on <a href="http://jenkins.example:8080/view/Quality%20reports/">the Quality reports view</a>; if you have a job name like <samp>quality-report-abc</samp> then this is <kdb>abc</kdb>.'
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
        longer_hint: 'For Git systems, we accept several flavors which provide us with richer data. Currently, only one source is accepted. If you use multiple version control systems, consider migrating them to one and provide the system with the most relevant source code.'
    }),
    version_control_domain: string({
        required: true,
        label: 'Version control domain',
        hint: 'The domain name plus optional port number where the version control system is hosted.',
        longer_hint: 'For example <samp>gitlab.example</samp> or <samp>tfs.example:8080</samp>.'
    }),
    version_control_auth: string({
        required: true,
        label: 'Version control authentication',
        choices: {
            none: 'Anonymous checkout',
            gitlab_api: 'GitLab API',
            gitlab_deploy: 'GitLab deploy key',
            user_pass: 'Username and password'
        },
        widget: widgets.select(),
        hint: 'The authentication scheme to use when connecting to the version control system.',
        longer_hint: `<ul>
            <li>Anonymous checkout: generally not an acceptable method.</li>
            <li>GitLab API: Use the API to register a specific SSH token for a user. This user needs at least Reporter level access permissions to the group. Generate an API token for this user on GitLab in the user's Settings, under Personal Access tokens. Use a descriptive name "GROS reporter" with no expiry for the "api" scope. Keep the username field in this form empty and provide the API token in the password field after that.</li>
            <li>GitLab deploy key: Administrator access to GitLab is required to register the deploy key pair. On Linux/Mac, use <kbd>ssh-keygen -t rsa -C "agent gitlab access" -b 4096 -f deploy_key</kbd> and press <kbd>Enter</kbd> twice to skip entering a passphrase (not supported at this moment). Insert the public part (found in <samp>deploy_key.pub</samp>) on GitLab in the Admin Area under Deploy Keys with a descriptive name <kbd>"GROS reporter"</kbd>, and without write access. Keep the next field empty and provide the contents of the private key (<samp>deploy_key</samp>) in the field after that.</li>
            <li>Username and password: Combination as used by TFS or Subversion. Provide the username and password in the next two fields.</li>
        </ul></div>`
    }),
    version_control_user: string({
        label: 'Version control username',
        hint: 'The username to login to the version control system with. Only used if the authentication is "Username and password".'
    }),
    version_control_token: string({
        label: 'Version control authentication token',
        widget: widgets.password(),
        hint: 'The password, deploy key or API token to login to the version control system with.'
    }),
    gitlab_group_name: string({
        label: 'GitLab group name',
        hint: 'The path name of the group on GitLab in which all the source code repositories are stored.',
        longer_hint: 'This is found under the Settings for the group on GitLab, with setting name "Group path". This is only necessary if the quality reporting dashboard has no metrics for the source code repository.'
    }),
    jenkins_host: string({
        label: 'Jenkins host',
        hint: 'The protocol, domain name and optionally port number of the Jenkins instance used for automated builds of the application developed by the team.',
        longer_hint: 'Get this from the main page of Jenkins by clicking on the logo in the top left and then copying the resulting URL, usually of the form <samp>http://jenkins.example:8080</samp>.'
    }),
    jenkins_user: string({
        label: 'Jenkins username',
        hint: 'The username to log in to Jenkins with. This is only necessary if Jenkins is completely restricted to logged-in users, since we only need read access.'
    }),
    jenkins_token: string({
        label: 'Jenkins token',
        widget: widgets.password(),
        hint: 'The password to log in to the Jenkins API with. This is only necessary if Jenkins is completely restricted to logged-in users.',
        longer_hint: 'Use an API token instead of the plain (LDAP) password. You can find the API token when you are logged in by clicking on your name in the top right, then Configure, and finally press <kbd><samp>Show API Token...</samp></kbd>'
    })
})

http.createServer(function (req, res) {
    config_form.handle(req, {
        success: function (form) {
            var req_data = parse(req.url, 1).query;
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.write('<h1>Success!</h1>');
            res.write('<h2>' + util.inspect(req_data) + '</h2>');
            res.end('<pre>' + util.inspect(form.data) + '</pre>');
        },
        other: function (form) {
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
