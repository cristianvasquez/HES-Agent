const serverOptions = require("../../config").serverOptions;
const express = require("express");
const fu = require("../persistence");
const _ = require('lodash');
const N3Parser = require('../lib/N3Parser/N3Parser');
const Context = require("../Context");
const reasoner = require("../reasoning");
const dsl_v1 = require("../dsl_v1");
const rp = require('request-promise');

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

                let context = new Context(req);

                // The URL of the directory to copy from
                let sourceUri = req.body['sourceUri'];
                if (!sourceUri) return res.sendStatus(404);
                if (!context.isLocalUrl(sourceUri)) return res.sendStatus(404);

                // The URL of the directory to copy to
                let targetUri = req.body['targetUri'];
                if (!targetUri) return res.sendStatus(404);
                if (!context.isLocalUrl(targetUri)) return res.sendStatus(404);

                let sourceDir = context.toLocalDir(sourceUri);
                if (!fu.exists(sourceDir)) return res.sendStatus(400);

                let targetDir = context.toLocalDir(targetUri);
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
                    let context = new Context(req);
                    let localDir = context.getLocalDir();
                    if (!fu.exists(localDir)) return res.sendStatus(400);
                    fu.deleteDirectory(localDir);
                    res.json(
                        {
                            "status": {
                                "deleted": context.getCurrentPath()
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
            let context = new Context(req);
            let virtuals = handleVirtuals(context);
            if (virtuals.isVirtual) {
                // Handle the corresponding virtual
                virtuals.callback(res)
            } else {
                // Build the default index.
                let index = buildIndex(processorOptions, req, res);
                res.json(index);
            }
        });

    }
}

function handleHref(context, value) {
    let target = dsl_v1.normalizeHref(context.getTail().getLocalDir(), value);
    return {
        isVirtual: true,
        callback: function (res) {
            res.redirect(context.toApiPath(target));
        }
    }
}

let hash = require('string-hash');

function rawToUrl(context, rawValue) {
    let filename = hash(rawValue)+".ttl";
    if (!fu.exists(filename)){
        fu.writeFile(serverOptions.workSpacePath + "/" + serverOptions.tmpFolder + "/" + filename, rawValue);
    }
    return context.getResourcesRoot() + "/" + serverOptions.tmpFolder + "/"+filename;
}

function handleInference(context, inference) {

    // Writes a temporary file to be read by Eye
    if (inference['hes:query']['hes:raw']) {
        inference['hes:query']['hes:href'] = rawToUrl(context, inference['hes:query']['hes:raw']);
        delete inference['hes:query']['hes:raw'];
    }

    // We found a inference operation, we invoke the eye reasoner
    let eyeOptions = dsl_v1.getEyeOptions(context.getTail().getLocalDir(), inference);
    return {
        isVirtual: true,
        callback: function (res) {
            Promise.resolve(reasoner.eyePromise(eyeOptions))
                .then(function (results) {
                    let result = body2JsonLD(results);
                    result["@id"] = context.getCurrentPath();
                    res.json(result);
                })
                .catch(function (error) {
                    res.json({error: error});
                });
        }
    };
}

// "hes:query": {
//     "hes:endpoint": "http://dbpedia.restdesc.org/",
//     "hes:defaultGraph": "http://dbpedia.org",
//     "hes:raw": "CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o } limit 10",
//     "hes:output": "text/turtle"
// }
function handleQuery(context, query) {
    let contentType = query['hes:Accept'];
    var options = {
        uri: query['hes:endpoint'],
        qs: {
            query: query['hes:raw'],
            "default-graph-uri": query['hes:default-graph-uri']
        },
        headers: {
            "Accept": contentType
        }
    };
    console.log(toJson(options));
    return {
        isVirtual: true,
        callback: function (res) {
            rp(options)
                .then(function (response) {
                    res.writeHead(200, {'Content-Type': contentType});
                    res.end(response, 'utf-8');
                })
                .catch(function (error) {
                    res.json({error: error});
                });
        }
    };
}

function handleVirtuals(context) {
    let localDir = context.getLocalDir();
    let exists = fu.exists(localDir);
    // Could be it is an inferred directory, or a link
    // We check the parent if there are defined operations
    if (!exists && context.getCurrentPath().length > context.getApiRoot().length) {
        let operationId = context.getHead();
        let localDir = context.getTail().getLocalDir();
        let index = fu.readJson(localDir + '/' + serverOptions.indexFile);
        if (index['hes:meta']) {
            for (let operation of index['hes:meta']) {
                if (operation['hes:name'] === operationId) {
                    // The operation exists, therefore needs to be handled.
                    return doOperation(context, operation);
                }
            }
        }
    }
    return {
        isVirtual: false
    };
}

function doOperation(context, operation) {
    if (operation['hes:href']) {
        return handleHref(context, operation['hes:href'])
    } else if (operation['hes:inference']) {
        return handleInference(context, operation['hes:inference']);
    } else if (operation['hes:query']) {
        return handleQuery(context, operation['hes:query']);
    } else if (operation['hes:inherit']) {
        /**
         * @TODO handle circular dependency.
         */
        return doOperation(context, handleInherit(context, operation['hes:inherit']));
    }
    throw new Error("Cannot handle " + toJson(operation));
}


// "hes:inherit": {
//         "hes:href":"file:///lib",
//         "hes:name":"whoIsWhat"
// }
function handleInherit(context, value) {

    let targetDir = dsl_v1.normalizeHref(context.getTail().getLocalDir(), value['hes:href']);

    // Gets the template
    let index = fu.readJson(targetDir + '/' + serverOptions.indexFile);
    if (!fu.exists(targetDir + '/' + serverOptions.indexFile)) {
        throw new Error("Could not find index in " + targetDir + '/' + serverOptions.indexFile);
    }

    if (index['hes:meta']) {
        for (let operation of index['hes:meta']) {
            if (operation['hes:name'] === value['hes:name']) {
                if (operation['hes:inference']) {
                    // Overrides inherited data if specified
                    if (value['hes:data']) {
                        operation['hes:inference']['hes:data'] = value['hes:data']
                    } else {
                        operation['hes:inference']['hes:data'] = operation['hes:inference']['hes:data'].map(x => {
                            return {'hes:href': dsl_v1.normalizeHref(targetDir, x['hes:href'])};
                        });
                    }
                    // Overrides inherited query if specified
                    if (value['hes:query']) {
                        operation['hes:inference']['hes:query'] = value['hes:query']
                    } else {
                        operation['hes:inference']['hes:query'] = {'hes:href': dsl_v1.normalizeHref(targetDir, operation['hes:inference']['hes:query']['hes:href'])};
                    }
                }
                return operation;
            }
        }
    }
    throw new Error("Could not find operation to inherit from " + toJson(value));
}

/**
 * Gets the index.json file and populates it with additional info such as files.
 */
function buildIndex(processorOptions, req, res) {
    let context = new Context(req);
    let localDir = context.getLocalDir();
    let contents = fu.readDir(localDir);

    // Was not an inferred operation, we read the index
    let result = fu.readJson(localDir + '/' + serverOptions.indexFile);
    result["@id"] = context.getCurrentPath();

    // Process directories
    if (processorOptions.showDirectories) {
        _.map(contents.directories,
            directory => {
                // Peek types
                let directoryIndex = fu.readJson(localDir + "/" + directory + '/' + serverOptions.indexFile);
                let type = _.get(directoryIndex, '@type', 'this:Resource');
                result["this:" + directory] = buildLink(context.getCurrentPath() + "/" + directory, type)
            }
        );
    }

    // We add the files
    if (processorOptions.showFiles) {
        function getPublicFiles(files) {
            return _.map(files.filter(filePath => !filePath.endsWith(serverOptions.indexFile)),
                filePath => buildLink(context.toResourcePath(filePath), 'Resource')
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
        let operations = [], currentOperation;

        // Handle build links for the operations
        for (currentOperation of _.filter(result['hes:meta'])) {
            let operationName = _.get(currentOperation, 'hes:name');
            let operationUri = context.getCurrentPath() + '/' + operationName;
            let link = buildLink(operationUri, 'Operation');
            if (currentOperation.description) {
                link['hes:description'] = currentOperation.description;
            }
            operations.push(link);
        }
        delete result['hes:meta'];
        result['this:operation'] = operations;
    }

    if (processorOptions.hydraOperations) {
        result["hydra:operations"] = processorOptions.hydraOperations;
    }

    return result
}


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

module.exports = HES;