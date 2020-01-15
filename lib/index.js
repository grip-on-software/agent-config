/* Agent web UI. */
'use strict';

const app = require('./app'),
      options = require('./options');

app.listen(options.listen_port, options.listen_address);

const url = `http://${options.listen_address}:${options.listen_port}/`;
console.log(`Server running at ${url}`);
if (app.get('env') === 'dev-sync') {
    setTimeout(function() {
        if (!app.hasConnection) {
            require('open')(options.listen_host ?
                `http://${options.listen_host}/` : url
            );
        }
    }, 1000);
}
