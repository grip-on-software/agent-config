/**
 * Agent web UI.
 *
 * Copyright 2017-2020 ICTU
 * Copyright 2017-2022 Leiden University
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

const app = require('./app'),
      options = require('./options');

app.listen(options.listen_port, options.listen_address);

const url = `http://${options.listen_address}:${options.listen_port}/`;
console.log(`Server running at ${url}`);
if (app.get('env') === 'dev-sync') {
    setTimeout(function() {
        if (!app.hasConnection) {
            /* jshint ignore:start */
            import('open').then(open => {
                open.default(options.listen_host ?
                    `http://${options.listen_host}/` : url
                );
            });
            /* jshint ignore: end */
        }
    }, 1000);
}
