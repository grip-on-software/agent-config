/**
 * Web server.
 *
 * Copyright 2017-2020 ICTU
 * Copyright 2017-2022 Leiden University
 * Copyright 2017-2023 Leon Helwerda
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

const express = require('express');
const hostValidation = require('host-validation');
const app = express();

app.options = {...require('./options')};
app.hasConnection = false;
if (app.get('env') === 'dev-sync') {
    const browserSync = require('browser-sync');
    const bs = browserSync.create();
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
    bs.emitter.on("client:connected", function() {
        app.hasConnection = true;
    });
    app.browserSync = bs;
    app.closeWatchers = function() {
        this.watchers.forEach(watcher => watcher.close());
    };
}

if (app.options.listen_host) {
    app.use(hostValidation({hosts: [app.options.listen_host]}));
}

require('./routes/index')(app);
require('./routes/edit')(app);
require('./routes/scrape')(app);
require('./routes/update')(app);
require('./routes/static')(app);

module.exports = app;
