const serverOptions = require("../config").serverOptions;
const fu = require("./persistence");
const _ = require('lodash');
const validUrl = require('valid-url');
const path = require('path');

function specToPublic(localDir, specPath) {

    let targetDirectory,files;

    if (specPath.startsWith('.')){ // Relative path
        targetDirectory = path.join(localDir, specPath);
    } else if (specPath.startsWith('file:///')) { // absolute
        targetDirectory = path.resolve(specPath.replaceAll('file://', serverOptions.workSpacePath));
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
    if (inference['hes:query']['hes:raw']) throw Error("Raw not supported yet in "+toJson(inference));
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
        query:query
    };
}

module.exports = {
    specToPublic:specToPublic,
    getEyeOptions:getEyeOptions
};
