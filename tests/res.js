/**
 * Utilities to execute frontend resources in JSDOM.
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

const URL = require('url').URL,
      babel = require('babel-core'),
      babelPluginIstanbul = require('babel-plugin-istanbul').default,
      jsdom = require('jsdom'),
      { JSDOM } = jsdom,
      _ = require('lodash'),
      axe = require('axe-core'),
      AxeReports = require('@ictu/axe-reports'),
      request = require('supertest');

const instrument = function(sourceCode, filename) {
  return babel.transform(sourceCode, {
    filename,
    plugins: [
      babelPluginIstanbul
    ]
  });
};

global.__coverage__ = global.__coverage__ || {};

var firstRun = true;

exports.loadPageWithScripts = function(app, response, done, timeout=2000) {
    const virtualConsole = new jsdom.VirtualConsole();
    // Fail the test immediately on uncaught/JSDOM errors
    virtualConsole.on("jsdomError", (error) => {
        done(error || "JSDOM Error");
    });
    virtualConsole.sendTo(console, { omitJSDOMErrors: true });
    const server = request(app);
    const axeRequest = server.get('/axe/axe.min.js');
    const host = (new URL(axeRequest.url)).origin;
    const window = (new JSDOM(response.text, {
        url: host,
        runScripts: "outside-only",
        pretendToBeVisual: true,
        virtualConsole
    })).window;
    window.__coverage__ = global.__coverage__;
    const { document } = window;
    const requestScripts = _.map(
        document.querySelectorAll('script'), script => script.src
    ).reduce((promise, src) => {
        return new Promise((resolve, reject) => {
            promise.then(() => {
                const url = (new URL(src));
                if (url.origin === host) {
                    const path = url.pathname;
                    server.get(path).then(scriptResponse => {
                        const code = path.slice(0, 5) === "/res/" ?
                            instrument(scriptResponse.text, path.slice(1)).code :
                            scriptResponse.text;
                        window.eval(code);
                        resolve();
                    }).catch((err) => {
                        reject(err);
                    });
                }
                else {
                    // Ignore all scripts that are not from our origin, as there
                    // should not be any we should depend on.
                    resolve();
                }
            }).catch((err) => {
                reject(err);
            });
        });
    }, Promise.resolve());
    
    return new Promise((resolve, reject) => {
        requestScripts.then(() => {
            setTimeout(() => {
                console.log('Running Axe test');
                axeRequest.then(scriptResponse => {
                    window.eval(scriptResponse.text);
                    window.eval(`axe.run(document, {
                        rules: {
                            'color-contrast': {
                                enabled: false
                            }
                        }
                    });`).then(result => {
                        AxeReports.processResults(result, 'csv', 'accessibility',
                            firstRun
                        );
                        firstRun = false;
                    }).catch(err => {
                        done(err);
                    });
                }).catch(err => {
                    done(err);
                });
            }, timeout);
            resolve(window);
        }).catch((err) => {
            reject(err);
        });
    });
};

