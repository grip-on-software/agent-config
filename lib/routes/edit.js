/* Form edit/sucess page served at '/edit' path. */
'use strict';

const fs = require('fs'),
      path = require('path'),
      async = require('async'),
      forms = require('forms'),
      formidable = require('formidable'),
      querystring = require('qs'),
      _ = require('lodash'),
      render = require('../template'),
      options = require('../options'),
      create_forms = require('../form'),
      config = require('../config');

const form_page = fs.readFileSync(__dirname + '/../../template/form.mustache').toString();
const success_page = fs.readFileSync(__dirname + '/../../template/success.mustache').toString();

module.exports = function(app) {
    function handleBody(body, res) {
        const settings = config.read('settings.cfg');
        const credentials = config.read('credentials.cfg');

        var config_forms = create_forms(body, settings, credentials);
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
                    config.update(data, config_forms);
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(render(success_page, {
                        title: 'Success',
                        config_url: options.config_path !== '' ? '/config' : false,
                        scrape_url: config.has_value(options.agent_host) ? '/scrape' : false,
                    }));
                }
                else {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(render(form_page, {
                        title: 'Agent configuration',
                        forms: config_forms,
                        component: function() {
                            return this.form.toHTML(this.cloneable ? this.id : void 0,
                                                    forms.render.div);
                        },
                        method: 'POST',
                        enctype: 'multipart/form-data'
                    }));
                }
            }
        );
    }

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
};
