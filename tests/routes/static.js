/**
 * Unit tests for static file routes.
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
/* jshint mocha: true */
'use strict';

const request = require('supertest'),
      assert = require('chai').assert,
      app = require('../../lib/app');

describe('Static', function() {
    it('Should provide indexes', function() {
        return request(app).get('/config/')
            .expect("Content-Type", "text/html; charset=utf-8")
            .expect(200);
    });

    it('Should open plain files', function() {
        return request(app).get('/config/VERSION')
            .expect("Content-Type", "text/plain")
            .expect("Content-Disposition", "inline")
            .expect(200)
            .expect("test-dev\n");
    });

    it('Should not provide files if configuration is missing', function(done) {
        delete require.cache[require.resolve('../../lib/app')];
        delete require.cache[require.resolve('../../lib/options')];
        const options = require('../../lib/options');
        options.config_path = '';
        options.export_path = '';
        const misApp = require('../../lib/app');
        request(misApp).get('/config/')
            .expect(404)
            .then(() => {
                request(misApp).get('/export/')
                    .expect(404, done);
            });
    });

    it('Should provide jQuery JS files', function() {
        return request(app).get('/jquery/jquery.min.js')
            .expect(200);
    });

    it('Should provide font-awesome CSS files', function() {
        return request(app).get('/font-awesome/css/all.min.css')
            .expect(200);
    });

    it('Should provide font-awesome webfont files', function() {
        return request(app).get('/font-awesome/webfonts/fa-solid-900.woff2')
            .expect(200);
    });
});
