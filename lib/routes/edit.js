/**
 * Form edit/sucess page served at '/edit' path.
 *
 * Copyright 2017-2020 ICTU
 * Copyright 2017-2022 Leiden University
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
      async = require('async'),
      forms = require('forms'),
      formidable = require('formidable'),
      querystring = require('qs'),
      _ = require('lodash'),
      render = require('../template'),
      createForms = require('../form'),
      config = require('../config');

const FORM_PAGE = fs.readFileSync(`${__dirname}/../../template/form.mustache`).toString();
const FORM_COMPONENT_PARTIAL = fs.readFileSync(`${__dirname}/../../template/form_component.mustache`).toString();
const SUCCESS_PAGE = fs.readFileSync(`${__dirname}/../../template/success.mustache`).toString();

module.exports = function(app) {
    function reduceForm(states, configForm, callback) {
        configForm.form.handle(configForm.body, {
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
    }

    const handleForms = function(configForms, res) {
        return function(error, formStates) {
            if (!formStates.other.length) {
                // Update configuration
                var data = formStates.success.reduce(function(result, form) {
                    return _.mergeWith(result, form.data, function(obj, src) {
                        if (typeof obj === "undefined") {
                            return src;
                        }
                        else if (_.isArray(obj) && !_.isArray(src)) {
                            return obj.concat(src);
                        }
                        return [obj, src];
                    });
                }, {});
                config.update(data, configForms);
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(render(SUCCESS_PAGE, {
                    title: 'Success',
                    config_url: app.options.config_path !== '' ?
                        '/config' : false,
                    scrape_url: config.has_value(app.options.agent_host) ?
                        '/scrape' : false,
                }));
                return;
            }
            // Display form
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(render(FORM_PAGE, {
                title: 'Agent configuration',
                forms: configForms,
                component: function() {
                    return this.form.toHTML(this.id,
                                            forms.render.div);
                },
                method: 'POST',
                enctype: 'multipart/form-data'
            }, {form_component: FORM_COMPONENT_PARTIAL}));
        };
    };

    function handleBody(body, res) {
        const settings = config.read('settings.cfg');
        const credentials = config.read('credentials.cfg');

        var configForms = createForms(body, settings, credentials);
        configForms.forEach(function(configForm) {
            const fields = configForm.form.fields;
            Object.keys(fields).forEach(function(k) {
                if (fields[k].setValue) {
                    fields[k].setValue(configForm, settings, credentials);
                }
            });
        });
        async.reduce(configForms, {"success": [], "other": []},
                     reduceForm, handleForms(configForms, res));
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
                if (err) {
                    throw err;
                }
                var parsedFields = querystring.parse(querystring.stringify(originalFields));
                handleBody(parsedFields, res);
            });
        }
    });
};
