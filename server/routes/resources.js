const Context = require("../Context");
const serverOptions = require('../../config').serverOptions;

const fs = require('fs-extra')
const express = require("express");
const router = express.Router();
const path = require('path');

router.get("/*", function(req, res, next) {

    let context = new Context(req);
    let filePath = context.getCurrentPath().replaceAll(context.getResourcesRoot(), serverOptions.workSpacePath);

    if (!fs.existsSync(filePath)){
        return res.sendStatus(404);
    }

    let extname = path.extname(filePath);
    let contentType = 'text/n3';
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
                    res.writeHead(200, { 'Content-Type': contentType });
                    res.end(content, 'utf-8');
                });
            }
            else {
                res.writeHead(500);
                res.end(+error.code+' ..\n');
                res.end();
            }
        }
        else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });

});

module.exports = router;