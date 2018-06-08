/* Utilities to execute frontend resources in JSDOM. */
'use strict';

const babel = require('babel-core'),
      babelPluginIstanbul = require('babel-plugin-istanbul').default,
      jsdom = require('jsdom'),
      { JSDOM } = jsdom,
      request = require('supertest');

const instrument = function(sourceCode, filename) {
  return babel.transform(sourceCode, {
    filename,
    plugins: [
      babelPluginIstanbul
    ]
  });
};

exports.loadPageWithScripts = function(app, response, done) {
    const virtualConsole = new jsdom.VirtualConsole();
    // Fail the test immediately on uncaught/JSDOM errors
    virtualConsole.on("jsdomError", (error) => {
        done(error || "JSDOM Error");
    });
    virtualConsole.sendTo(console, { omitJSDOMErrors: true });
    const window = (new JSDOM(response.text, {
        runScripts: "outside-only",
        pretendToBeVisual: true,
        virtualConsole
    })).window;
    const { document } = window;
    const promise = Array.from(
        document.querySelectorAll('script'), script => script.src
    ).reduce((promise, src) => {
        return new Promise((resolve, reject) => {
            promise.then(() => {
                request(app).get(src).then(scriptResponse => {
                    const code = src.slice(0, 5) === "/res/" ?
                        instrument(scriptResponse.text, src.slice(1)).code :
                        scriptResponse.text;
                    window.eval(code);
                    resolve();
                }).catch((err) => {
                    reject(err);
                });
            }).catch((err) => {
                reject(err);
            });
        });
    }, Promise.resolve());
    
    return new Promise((resolve, reject) => {
        promise.then(() => {
            resolve(window);
        }).catch((err) => {
            reject(err);
        });
    });
};

