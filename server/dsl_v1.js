const serverOptions = require("../config").serverOptions;
const fu = require("./persistence");
const _ = require('lodash');
const validUrl = require('valid-url');
const path = require('path');


function normalizeHref(dirRelativeTo,value){

    if (typeof value !== 'string'){
        throw Error("I don't know how to handle href: "+value);
    }
    if (value.startsWith(serverOptions.workSpacePath)) {
        return value;
    } else if (value.startsWith('.')) { // Relative path
        return path.join(dirRelativeTo, value);
    } else if (value.startsWith('file:///')) { // absolute
        return path.resolve(value.replaceAll('file://', serverOptions.workSpacePath));
    }
    throw Error("I don't know how to handle href: "+value);
}

function specToPublic(dirRelativeTo,specPath) {
    if (validUrl.is_web_uri(specPath)) { // other uri resources
        return [specPath]
    }
    let targetDirectory = normalizeHref(dirRelativeTo,specPath);
    let files = fu.readDir(targetDirectory).files;
    if (!files){
        let errorMessage = "404 ["+targetDirectory+"]";
        console.error(errorMessage);
        throw Error(errorMessage);
    }

    return files.filter(x=>!x.endsWith(serverOptions.indexFile));
}
/**
 * Inteprets things like:
 {
      "hes:data": [
        {
          "hes:href":"./data"
        }
      ],
      "hes:query":{
        "hes:href": "file:///lib/query/whoIsWhat.n3"
      }
    }
 */
function toJson(x){
   return JSON.stringify(x,null,2);
}

function getEyeOptions(localDir, inference) {

    if (!inference['hes:query']) throw Error("Query needs to be defined in "+toJson(inference));
    if (inference['hes:query']['hes:raw']) throw Error("Raw not yet supported yet in "+toJson(inference));
    if (!inference['hes:query']['hes:href']) throw Error("Query needs to be specified in "+toJson(inference));
    let query = specToPublic(localDir,inference['hes:query']['hes:href']);
    let data = _.flatMap(inference['hes:data'],x => {
        if (x['hes:href']) {
            return specToPublic(localDir, x['hes:href']);
        } else {
            throw Error("Raw not supported yet in "+toJson(x));
        }
    });

    return {
        data:data,
        query:query,
        flags:inference['eye:flags']
    };
}

module.exports = {
    specToPublic:specToPublic,
    normalizeHref:normalizeHref,
    getEyeOptions:getEyeOptions
};
