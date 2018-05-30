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
    app.watchers = [];
    const watch = function(pattern) {
        app.watchers.push(bs.watch(`res/${pattern}`).on("change", function() {
            bs.reload(pattern);
        }));
    };
    watch("*.css");
    watch("*.js");
    app.use(require('connect-browser-sync')(bs));
    bs.emitter.on("client:connected", function() { app.hasConnection = true; });
    app.browserSync = bs;
    app.closeWatchers = function() {
        this.watchers.forEach(watcher => watcher.close());
    };
}

require('./routes/index')(app);
require('./routes/edit')(app);
require('./routes/scrape')(app);
require('./routes/update')(app);
require('./routes/static')(app);

module.exports = app;
