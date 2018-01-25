var config = require('../config');
const path = require('path');
const fu = require("./persistence");

function root(req){
    return "http://"+req.headers.host;
}

function base(req){
    return root(req) + req.originalUrl.replace(/\/$/, "");
}

function apiPath(req){
    return root(req)+"/"+config.appEntrypoint
}

function resourcesPath(req){
    return root(req)+"/"+config.resourcesEntryPoint
}

function localPathToPublic(localPath, req){
    return localPath.replaceAll(config.workSpacePath,resourcesPath(req));
}

function resourceToLocal(req){
    return base(req).replaceAll(resourcesPath(req),config.workSpacePath);
}

function publicToLocal(publicUrl, req){
    return publicUrl.replaceAll(apiPath(req),config.workSpacePath);
}

var validUrl = require('valid-url');


function specToPublic(currentPath, specPath) {

    let targetDirectory,files;

    if (specPath.startsWith('.')){ // Relative path
        targetDirectory = path.join(currentPath, specPath);
    } else if (specPath.startsWith('file://resources')) { // absolute
        targetDirectory = path.resolve(specPath.replaceAll('file://resources', config.workSpacePath));
    } else if (validUrl.isUri(specPath)) { // other uri resources
        return [specPath]
    } else {
        let errorMessage = specPath+" not recognized";
        console.error(errorMessage);
        throw Error(errorMessage);
    }

    files = fu.readDir(targetDirectory).files;
    if (!files){
        let errorMessage = "404 ["+targetDirectory+"]";
        console.error(errorMessage);
        throw Error(errorMessage);
    }

    return files.filter(x=>!x.endsWith(config.indexFile));
}

module.exports = {
    base:base,
    apiPath:apiPath,
    localPathToPublic:localPathToPublic,
    publicToLocal:publicToLocal,
    specToPublic:specToPublic,
    resourceToLocal:resourceToLocal
};
