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
      validators = forms.validators;

var string = function(opts) {
    var f = fields.string(opts);
    var toHTML = f.toHTML;
    f.toHTML = function(name, iterator) {
        return toHTML.call(this, name, iterator) +
            (this.hint ? '<div class="hint">' + this.hint + '</div>' : '');
    };
    return f;
};

const config_form = forms.create({
    bigboat_url: string({ required: true, label: 'BigBoat URL',
        hint: 'The URL to the location of the BigBoat dashboard.'
    }),
    bigboat_key: string({ required: true, label: 'BigBoat key',
        hint: "An API key of the BigBoat dashboard. You can generate a new key on the dashboard's configuration page. Do not generate the API key while logged out. Any logged-in API key works."
    }),
    jira_key: string({ required: true, label: 'JIRA key prefix' }),
    quality_report_name: string({ required: true, label: 'Quality report name' })
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
