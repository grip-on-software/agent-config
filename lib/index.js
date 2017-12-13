/* Agent web UI. */
'use strict';

const express = require('express'),
      options = require('./options');

var app = express();
var hasConnection = false;
if (app.get('env') === 'dev-sync') {
    var browserSync = require('browser-sync');
    var bs = browserSync.create();
    bs.init({ logSnippet: false }, bs.reload);
    bs.watch("res/*.css").on("change", function() { bs.reload("*.css"); });
    bs.watch("res/*.js").on("change", function() { bs.reload("*.js"); });
    app.use(require('connect-browser-sync')(bs));
    bs.emitter.on("client:connected", function() { hasConnection = true; });
}

require('./routes/index')(app);
require('./routes/edit')(app);
require('./routes/scrape')(app);
require('./routes/update')(app);
require('./routes/static')(app);

app.listen(options.listen_port, options.listen_address);

const url = 'http://' + options.listen_address + ':' + options.listen_port + '/';
console.log('Server running at ' + url);
if (app.get('env') === 'dev-sync') {
    setTimeout(function() {
        if (!hasConnection) {
            require('opn')(url);
        }
    }, 1000);
}
