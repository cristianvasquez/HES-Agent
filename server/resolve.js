const serverOptions = require("../config").serverOptions;
const fu = require("./persistence");

function root(req){
    return "http://"+req.headers.host;
}

function base(req){
    return root(req) + req.originalUrl.replace(/\/$/, "");
}

function apiPath(req){
    return root(req)+"/"+serverOptions.appEntrypoint
}

function resourcesPath(req){
    return root(req)+"/"+serverOptions.resourcesEntryPoint
}

function localPathToPublic(localPath, req){
    return localPath.replaceAll(serverOptions.workSpacePath,resourcesPath(req));
}

function resourceToLocal(req){
    let publicUrl = base(req);
    let result =  publicUrl.replaceAll(resourcesPath(req),serverOptions.workSpacePath);
    if (result === publicUrl){
        throw new Error("Cannot resolve to persistence layer")
    } else return result;
}

function publicToLocal(publicUrl, req){
    let result = publicUrl.replaceAll(apiPath(req),serverOptions.workSpacePath);
    if (result === publicUrl){
        throw new Error("Cannot resolve to persistence layer")
    } else return result;
}

var validUrl = require('valid-url');
var path = require('path');

function specToPublic(currentPath, specPath) {

    let targetDirectory,files;

    if (specPath.startsWith('.')){ // Relative path
        targetDirectory = path.join(currentPath, specPath);
    } else if (specPath.startsWith('file://resources')) { // absolute
        targetDirectory = path.resolve(specPath.replaceAll('file://resources', serverOptions.workSpacePath));
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

    return files.filter(x=>!x.endsWith(serverOptions.indexFile));
}

module.exports = {
    base:base,
    apiPath:apiPath,
    localPathToPublic:localPathToPublic,
    publicToLocal:publicToLocal,
    resourceToLocal:resourceToLocal,
    specToPublic:specToPublic
};
