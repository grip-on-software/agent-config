/* Templates for parts of pages. */
'use strict';

const fs = require('fs'),
      Mustache = require('mustache');
const head_partial = fs.readFileSync(__dirname + '/../template/head.mustache').toString();

module.exports = function render(template, parameters, partials) {
    return Mustache.render(template, parameters, Object.assign({}, {
        head: head_partial
    }, partials));
};
