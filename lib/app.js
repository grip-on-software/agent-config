/* Web server. */
'use strict';

const express = require('express');
var app = express();

app.options = Object.assign({}, require('./options'));
app.hasConnection = false;
if (app.get('env') === 'dev-sync') {
    var browserSync = require('browser-sync');
    var bs = browserSync.create();
    bs.init({ logSnippet: false }, bs.reload);
    bs.watch("res/*.css").on("change", function() { bs.reload("*.css"); });
    bs.watch("res/*.js").on("change", function() { bs.reload("*.js"); });
    app.use(require('connect-browser-sync')(bs));
    bs.emitter.on("client:connected", function() { app.hasConnection = true; });
}

require('./routes/index')(app);
require('./routes/edit')(app);
require('./routes/scrape')(app);
require('./routes/update')(app);
require('./routes/static')(app);

module.exports = app;
