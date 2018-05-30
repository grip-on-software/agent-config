/* Upstream request handlers. */
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
    var message = '';
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
