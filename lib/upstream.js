/**
 * Upstream request handlers.
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

exports.setRequestTimeout = function(res, upstreamReq, timeout, onReject) {
    upstreamReq.setTimeout(timeout, function() {
        res.writeHead(500);
        res.end(JSON.stringify(onReject('Connection to the upstream server timed out')));
    }).on('error', function(e) {
        res.writeHead(500);
        res.end(JSON.stringify(onReject(e.message)));
    });
};

exports.channelJSON = function(res, upstreamRes, expectedCode, onReject) {
    upstreamRes.on('error', function(e) {
        res.writeHead(500);
        res.end(JSON.stringify(onReject(e.message)));
    });
    let message = '';
    if (upstreamRes.statusCode === expectedCode) {
        upstreamRes.on('data', function(chunk) {
            res.write(chunk);
        });
    }
    else {
        upstreamRes.on('data', function(chunk) {
            message += chunk;
        });
    }
    upstreamRes.on('end', function() {
        res.end(upstreamRes.statusCode === expectedCode ? '' :
            JSON.stringify(onReject(message.trim()))
        );
    });
};
