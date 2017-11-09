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
const config_form = forms.create({
    bigboat_url: fields.string({ required: true, label: 'BigBoat URL' }),
    bigboat_key: fields.string({ required: true, label: 'BigBoat key' }),
    jira_key: fields.string({ required: true, label: 'JIRA key prefix' }),
    quality_report_name: fields.string({ required: true, label: 'Quality report name' })
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
