/* Templates for parts of pages. */
'use strict';

const fs = require('fs'),
      Mustache = require('mustache');
const HEAD_PARTIAL = fs.readFileSync(`${__dirname}/../template/head.mustache`).toString();

module.exports = function render(template, parameters, partials) {
    return Mustache.render(template, parameters, Object.assign({}, {
        head: HEAD_PARTIAL
    }, partials));
};
