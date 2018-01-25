const config = require("../../config");
const express = require("express");
const router = express.Router();
const fu = require("../persistence");
const _ = require('lodash');
const N3Parser = require('../lib/N3Parser/N3Parser');
const resolve = require("../resolve");
const reasoning = require("../reasoning");

function buildLink(uri,type){
    return {
        "@id": uri,
        "@type":type
    }
}

/**
 * Index.
 */
router.get("/", function(req, res, next) {
    var result = populateIndex(req);
    res.json(result);
});

/**
 * Gets the index.json file and populates it with additional info such as files.
 */
function populateIndex(req) {
    var baseUri = resolve.base(req);
    var localDir =  resolve.publicToLocal(resolve.base(req),req);

    // Read the index
    var result = fu.readJson(localDir+'/'+config.indexFile);

    result["@id"] = baseUri;
    var contents = fu.readDir(localDir);

    // Process directories
    _.map(contents.directories,
        directory=> {
            // Peek types
            let directoryIndex = fu.readJson(localDir+"/"+directory+'/'+config.indexFile);
            let type = _.get(directoryIndex, '@type', 'this:Resource');
            result["this:" + directory] = buildLink(baseUri + "/" + directory, type)
        }
    );

    // Process files
    function getPublicFiles(files) {
        return _.map(files.filter(filePath => !filePath.endsWith(config.indexFile)),
            filePath => buildLink(resolve.localPathToPublic(filePath,req), 'Resource')
        );
    }
    if (contents.files){
        let publicFiles = getPublicFiles(contents.files);
        if (!_.isEmpty(publicFiles)){
            result["this:files"] = publicFiles;
        }
    }

    // Process meta
    if (result['meta:operation']){
        let operations = [], currentOperation;

        // Handle build links for the operations
        for (currentOperation of _.filter(result['meta:operation'])) {
            let operationName =_.get(currentOperation, 'operation');
            let operationUri = baseUri+'/'+operationName+'/execute';
            let link = buildLink(operationUri,'Operation');
            if (currentOperation.description){
                link['this:description']=currentOperation.description;
            }
            operations.push(link);
        }

        delete result['meta:operation'];
        result['this:operation']=operations;
    }

    result["hydra:operations"] = ["GET","DELETE"];
    return result
}

function body2JsonLD(body){
    let n3Parser = new N3Parser();
    let jsonLd = n3Parser.toJSONLD(body);
    let eyeResponse = JSON.stringify(jsonLd, null, 4);
    return JSON.parse(eyeResponse);
}

function beforeLast(url){
    return url.substr(0,url.lastIndexOf('/'));
}

function lastSegment(url){
    return url.substr(url.lastIndexOf('/') + 1);
}

function getEye(operation,localDir){
    function getInput(input){
        return _.flatMap(_.get(operation, input), currentPath => resolve.specToPublic(localDir,currentPath));
    }

    let data = _.flatten([getInput('input.data'),getInput('input.n3'),getInput('input.turtle')]);
    let query = getInput('input.query');

    if (query.length!==1){
        throw Error("Only one query at a time is supported")
    }

    return reasoning.eyePromise(data, query[0]);
}

router.get("*/:operationId/execute", function(req, res, next) {
    let operationId = req.params.operationId;
    let baseUri = resolve.base(req);
    let localDir = beforeLast(beforeLast(resolve.publicToLocal(resolve.base(req),req)));
    let operationIndex = fu.readRequired(localDir+'/'+config.indexFile);

    if (operationIndex['meta:operation']) {
        /**
         * Inference operations
         */
        let eyeOperation = _.find(operationIndex['meta:operation'], {
            '@type':['this:EyeOperation'],
            'operation': operationId
        });

        /**
         * Aggregated inference operation
         */
        let aggregatedOperation = _.find(operationIndex['meta:operation'], {
            '@type': ['this:EyeAggregatedOperation'],
            'operation': operationId
        });

        if (eyeOperation){

            Promise.resolve(getEye(eyeOperation,localDir))
                .then(function (results) {
                    let result = body2JsonLD(results);
                    result["@id"] = baseUri;
                    res.json(result);
                })
                .catch(function (error) {
                    res.json({error: error});
                });

        } else if (aggregatedOperation){
            doAggregated(operationId, localDir, baseUri, res);
        } else {
            throw Error('No operations found in:'+localDir+'/'+config.indexFile+" for operation type: "+operationId);
        }

    } else {
        throw Error('No meta-operations found in:'+localDir+'/'+config.indexFile);
    }

});

function doAggregated(operationId, localDir, baseUri, res) {
    let promises = [];
    let children = fu.readDir(localDir);
    if (children.directories) {
        for (let directory of children.directories){
            let childIndex = fu.readJson(localDir + "/" + directory + '/' + config.indexFile);
            let child = _.find(childIndex['meta:operation'], {'@type': ['this:EyeOperation']});
            if (child) {
                promises.push(getEye(child, localDir + "/" + directory))
            }
        }
        Promise.all(promises)
            .then(function (results) {
                let result = {};
                result["@id"] = baseUri;
                result["this:aggregated"]=results.map(x=>body2JsonLD(x));
                res.json(result);
            })
            .catch(function (error) {
                res.json({error: error});
                // throw Error(error);
            });
    }
}

/**
 * copy the contents of one path to another
 */
router.post("/operations/copy", function(req, res, next) {

    // The URL of the directory to copy from
    let sourceUri =  req.body['sourceUri'];
    if (!sourceUri) return res.sendStatus(404);

    // The URL of the directory to copy to
    let targetUri =  req.body['targetUri'];
    if (!targetUri) return res.sendStatus(404);

    let sourceDir = resolve.publicToLocal(sourceUri,req);
    let targetDir = resolve.publicToLocal(targetUri,req);

    if (!fu.exists(sourceDir)) return res.sendStatus(400);
    if (!fu.exists(targetDir)) return res.sendStatus(400);

    let operationName = lastSegment(sourceDir);
    fu.copyDirectory(sourceDir, targetDir+"/"+operationName);

    res.json(
        {
            "created":  targetUri + "/"+ operationName
        }
    )
});


/**
 * Delete
 */
router.delete("*", function(req, res, next) {
    let localDir = resolve.publicToLocal(req);
    if (!fu.exists(localDir)) return res.sendStatus(400);
    fu.deleteDirectory(localDir);
    res.json(
        {
            "status": {
                "deleted": resolve.base(req)
            }
        }
    )
});

/**
 * Fallback
 */
router.get("*", function(req, res, next) {
    let result = populateIndex(req);
    res.json(result);
});

module.exports = router;