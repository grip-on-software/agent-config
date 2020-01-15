/* Update check endpoint served at '/update' path. */
'use strict';

const express = require('express'),
      serveIndex = require('serve-index');

const INDEX_CONFIG = {icons: true};
const STATIC_CONFIG = {
    setHeaders: function(res, path) {
        res.setHeader("Content-Type", "text/plain");
        res.setHeader("Content-Disposition", "inline");
    }
};

module.exports = function(app) {
    if (app.options.export_path !== '') {
        app.use('/export',
            express.static(app.options.export_path, STATIC_CONFIG),
            serveIndex(app.options.export_path, INDEX_CONFIG)
        );
    }
    if (app.options.config_path !== '') {
        app.use('/config',
            express.static(app.options.config_path, STATIC_CONFIG),
            serveIndex(app.options.config_path, INDEX_CONFIG)
        );
    }

    app.use('/res', express.static(`${__dirname}/../../res/`));
    app.use('/jquery', express.static(`${__dirname}/../../node_modules/jquery/dist/`));
    app.use('/font-awesome', express.static(`${__dirname}/../../node_modules/@fortawesome/fontawesome-free/`));
    // For dev test
    app.use('/axe', express.static(`${__dirname}/../../node_modules/axe-core/`));
};
