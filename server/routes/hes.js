const serverOptions = require("../../config").serverOptions;
const express = require("express");
const fu = require("../persistence");
const _ = require('lodash');
const N3Parser = require('../lib/N3Parser/N3Parser');
const resolve = require("../resolve");
const reasoner = require("../reasoning");
const dsl_v1 = require("../dsl_v1");
const path = require('path');
const validUrl = require('valid-url');

class HES extends express.Router {

    constructor(processorOptions) {
        super();

        if (!processorOptions) {
            throw new Error("must define processor options example: " + JSON.stringify(config.processorOptions, null, 2));
        }

        this.processorOptions = processorOptions;

        /**
         * copy the contents of one path to another
         */

        if (this.processorOptions.hydraOperations.indexOf('COPY')) {
            this.post("/operations/copy", function (req, res, next) {

                // The URL of the directory to copy from
                let sourceUri = req.body['sourceUri'];
                if (!sourceUri) return res.sendStatus(404);

                // The URL of the directory to copy to
                let targetUri = req.body['targetUri'];
                if (!targetUri) return res.sendStatus(404);

                let sourceDir = resolve.publicToLocal(sourceUri, req);
                let targetDir = resolve.publicToLocal(targetUri, req);

                if (!fu.exists(sourceDir)) return res.sendStatus(400);
                if (!fu.exists(targetDir)) return res.sendStatus(400);

                let operationName = sourceDir.substr(sourceDir.lastIndexOf('/') + 1)
                fu.copyDirectory(sourceDir, targetDir + "/" + operationName);

                res.json(
                    {
                        "created": targetUri + "/" + operationName
                    }
                )
            });
        }

        /**
         * Delete
         */
        if (this.processorOptions.hydraOperations.indexOf('DELETE')) {
            this.delete("*", function (req, res, next) {
                if (this.processorOptions.hydraOperations) {
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
                }
            });
        }

        /**
         * Fallback
         */
        this.get("*", function (req, res, next) {
            let index = buildIndex(processorOptions, req, res);
            if (index) {
                res.json(index);
            }
        });

    }
}

function populateMeta(result, baseUri) {
    let operations = [], currentOperation;
    // Handle build links for the operations
    for (currentOperation of _.filter(result['hes:meta'])) {
        let operationName = _.get(currentOperation, 'hes:name');
        let operationUri = baseUri + '/' + operationName;
        let link = buildLink(operationUri, 'Operation');
        if (currentOperation.description) {
            link['hes:description'] = currentOperation.description;
        }
        operations.push(link);
    }
    delete result['hes:meta'];
    result['this:operation'] = operations;
}

function handleOperations(baseUri, req, res) {
    let parent = baseUri.substr(0, baseUri.lastIndexOf('/'));
    let operationId = baseUri.substr(baseUri.lastIndexOf('/') + 1);
    let parentDir = resolve.publicToLocal(parent, req);
    let parentIndex = fu.readJson(parentDir + '/' + serverOptions.indexFile);
    if (parentIndex['hes:meta']) {
        for (let operation of parentIndex['hes:meta']) {
            if (operation[['hes:name']] === operationId) {
                if (operation['hes:href']) {

                    /**
                     * Basic link operation
                     */

                    let target;
                    if (operation['hes:href'].startsWith('.')) { // Relative path
                        target = resolve.localPathToPublic(path.join(parentDir, operation['hes:href']), req);
                    } else if (operation['hes:href'].startsWith('file:///')) { // absolute
                        target = operation['hes:href'].replaceAll('file://', resolve.apiPath(req));
                    } else if (validUrl.isUri(operation['hes:href'])) { // other uri resources
                        target = operation['hes:href'];
                    }

                    res.redirect(target);
                    return {dispatched:true}; // Just in case.
                } else if (operation['hes:inference']) {

                    /**
                     * Inference operation
                     */

                    // We found a inference operation, we invoke the eye reasoner
                    let eyeOptions = dsl_v1.getEyeOptions(operation['hes:inference'], parentDir);
                    Promise.resolve(reasoner.eyePromise(eyeOptions))
                        .then(function (results) {
                            let result = body2JsonLD(results);
                            result["@id"] = baseUri;
                            res.json(result);
                        })
                        .catch(function (error) {
                            res.json({error: error});
                        });
                    return {dispatched:true}; // Just in case.
                } else {
                    throw new Error("Cannot handle " + toJson(operation));
                }
            }
        }
    }
    return {dispatched:false};
}

/**
 * Gets the index.json file and populates it with additional info such as files.
 */
function buildIndex(processorOptions, req, res) {

    let baseUri = resolve.base(req);
    let localDir = resolve.publicToLocal(resolve.base(req), req);
    let contents = fu.readDir(localDir);

    // Could be it is an inferred directory, or a link
    // We check the parent if there are defined operations
    if ((!contents.exists) && baseUri.length > resolve.apiPath(req).length) {
        if (handleOperations(baseUri, req, res).dispatched) {
            return; // I don't know how to deal with this in javascript yet.
        }
    }

    // Was not an inferred operation, we read the index
    let result = fu.readJson(localDir + '/' + serverOptions.indexFile);
    result["@id"] = baseUri;

    // Process directories
    if (processorOptions.showDirectories) {
        _.map(contents.directories,
            directory => {
                // Peek types
                let directoryIndex = fu.readJson(localDir + "/" + directory + '/' + serverOptions.indexFile);
                let type = _.get(directoryIndex, '@type', 'this:Resource');
                result["this:" + directory] = buildLink(baseUri + "/" + directory, type)
            }
        );
    }

    // We add the files
    if (processorOptions.showFiles) {
        function getPublicFiles(files) {
            return _.map(files.filter(filePath => !filePath.endsWith(serverOptions.indexFile)),
                filePath => buildLink(resolve.localPathToPublic(filePath, req), 'Resource')
            );
        }
        if (contents.files) {
            let publicFiles = getPublicFiles(contents.files);
            if (!_.isEmpty(publicFiles)) {
                result["this:files"] = publicFiles;
            }
        }
    }

    // And process the meta
    if (result['hes:meta']) {
        populateMeta(result, baseUri);
    }

    if (processorOptions.hydraOperations) {
        result["hydra:operations"] = processorOptions.hydraOperations;
    }

    return result
}


// /**
//  * Aggregated inference operation
//  */
// let aggregatedOperation = _.find(operationIndex['hes:meta'], {
//     '@type': ['this:EyeAggregatedOperation'],
//     'operation': operationId
// });

// } else if (aggregatedOperation) {
//
//
//     let promises = [];
//     let children = fu.readDir(localDir);
//     if (children.directories) {
//         for (let directory of children.directories) {
//             let childIndex = fu.readJson(localDir + "/" + directory + '/' + serverOptions.indexFile);
//             let child = _.find(childIndex['meta:operation'], {'@type': ['this:EyeOperation']});
//             if (child) {
//                 promises.push(getEye(child, localDir + "/" + directory))
//             }
//         }
//         Promise.all(promises)
//             .then(function (results) {
//                 let result = {};
//                 result["@id"] = baseUri;
//                 result["this:aggregated"] = results.map(x => body2JsonLD(x));
//                 res.json(result);
//             })
//             .catch(function (error) {
//                 res.json({error: error});
//             });
//     }

function buildLink(uri, type) {
    return {
        "@id": uri,
        "@type": type
    }
}

function toJson(x) {
    return JSON.stringify(x, null, 2);
}

function body2JsonLD(body) {
    let n3Parser = new N3Parser();
    let jsonLd = n3Parser.toJSONLD(body);
    let eyeResponse = JSON.stringify(jsonLd, null, 4);
    return JSON.parse(eyeResponse);
}

module.exports = HES;