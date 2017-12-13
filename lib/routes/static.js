/* Update check endpoint served at '/update' path. */
'use strict';

const express = require('express'),
      serveIndex = require('serve-index'),
      options = require('../options');

const index_config = {icons: true};
const static_config = {
    setHeaders: function(res, path) {
        res.setHeader("Content-Type", "text/plain");
        res.setHeader("Content-Disposition", "inline");
    }
};

module.exports = function(app) {
    if (options.export_path !== '') {
        app.use('/export', express.static(options.export_path, static_config),
            serveIndex(options.export_path, index_config)
        );
    }
    if (options.config_path !== '') {
        app.use('/config', express.static(options.config_path, static_config),
            serveIndex(options.config_path, index_config)
        );
    }

    app.use('/res', express.static(__dirname + '/../../res/'));
    app.use('/jquery', express.static(__dirname + '/../../node_modules/jquery/dist/'));
    app.use('/font-awesome', express.static(__dirname + '/../../node_modules/font-awesome/'));
};
