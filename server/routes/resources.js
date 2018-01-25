const config = require("../../config");
const resolve = require("../resolve");
var fs = require('fs-extra')
const express = require("express");
const router = express.Router();
var path = require('path');

router.get("/*", function(request, response, next) {

    var filePath = resolve.resourceToLocal(request);
    var extname = path.extname(filePath);
    var contentType = 'text/n3';
    switch (extname) {
        case '.js':
            contentType = 'text/javascript';
            break;
        case '.css':
            contentType = 'text/css';
            break;
        case '.json':
            contentType = 'application/json';
            break;
        case '.png':
            contentType = 'image/png';
            break;
        case '.jpg':
            contentType = 'image/jpg';
            break;
        case '.wav':
            contentType = 'audio/wav';
            break;
        case '.ttl':
            contentType = 'text/n3';
            break;
        case '.n3':
            contentType = 'text/n3';
            break;
    }

    fs.readFile(filePath, function(error, content) {
        if (error) {
            if(error.code === 'ENOENT'){
                fs.readFile('./404.html', function(error, content) {
                    response.writeHead(200, { 'Content-Type': contentType });
                    response.end(content, 'utf-8');
                });
            }
            else {
                response.writeHead(500);
                response.end('Sorry, check with the site admin for error: '+error.code+' ..\n');
                response.end();
            }
        }
        else {
            response.writeHead(200, { 'Content-Type': contentType });
            response.end(content, 'utf-8');
        }
    });

});

module.exports = router;