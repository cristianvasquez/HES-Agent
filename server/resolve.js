const serverOptions = require("../config").serverOptions;

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


module.exports = {
    base:base,
    apiPath:apiPath,
    localPathToPublic:localPathToPublic,
    publicToLocal:publicToLocal,
    resourceToLocal:resourceToLocal,
};
