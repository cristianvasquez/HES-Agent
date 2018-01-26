const config = require("../../config");
const express = require("express");
const fu = require("../persistence");
const _ = require('lodash');
const N3Parser = require('../lib/N3Parser/N3Parser');
const resolve = require("../resolve");
const reasoning = require("../reasoning");

class HES extends express.Router {

    constructor(processorOptions) {
        super();

        if (!processorOptions) {
            throw new Error("must define processor options");
        }
        this.processorOptions = processorOptions;

        this.get("*/:operationId/execute", function (req, res, next) {
            let operationId = req.params.operationId;
            let baseUri = resolve.base(req);
            let localDir = resolve.publicToLocal(resolve.base(req), req).beforeLast().beforeLast();
            let operationIndex = fu.readRequired(localDir + '/' + processorOptions.indexFile);

            if (operationIndex['meta:operation']) {
                /**
                 * Inference operations
                 */
                let eyeOperation = _.find(operationIndex['meta:operation'], {
                    '@type': ['this:EyeOperation'],
                    'operation': operationId
                });

                /**
                 * Aggregated inference operation
                 */
                let aggregatedOperation = _.find(operationIndex['meta:operation'], {
                    '@type': ['this:EyeAggregatedOperation'],
                    'operation': operationId
                });

                if (eyeOperation) {
                    Promise.resolve(getEye(eyeOperation, localDir))
                        .then(function (results) {
                            let result = body2JsonLD(results);
                            result["@id"] = baseUri;
                            res.json(result);
                        })
                        .catch(function (error) {
                            res.json({error: error});
                        });

                } else if (aggregatedOperation) {


                    let promises = [];
                    let children = fu.readDir(localDir);
                    if (children.directories) {
                        for (let directory of children.directories) {
                            let childIndex = fu.readJson(localDir + "/" + directory + '/' + processorOptions.indexFile);
                            let child = _.find(childIndex['meta:operation'], {'@type': ['this:EyeOperation']});
                            if (child) {
                                promises.push(getEye(child, localDir + "/" + directory))
                            }
                        }
                        Promise.all(promises)
                            .then(function (results) {
                                let result = {};
                                result["@id"] = baseUri;
                                result["this:aggregated"] = results.map(x => body2JsonLD(x));
                                res.json(result);
                            })
                            .catch(function (error) {
                                res.json({error: error});
                            });
                    }

                } else {
                    throw Error('No operations found in:' + localDir + '/' + processorOptions.indexFile + " for operation type: " + operationId);
                }

            } else {
                throw Error('No meta-operations found in:' + localDir + '/' + processorOptions.indexFile);
            }

        });

        /**
         * copy the contents of one path to another
         */
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

            let operationName = sourceDir.lastSegment();
            fu.copyDirectory(sourceDir, targetDir + "/" + operationName);

            res.json(
                {
                    "created": targetUri + "/" + operationName
                }
            )
        });

        /**
         * Delete
         */
        this.delete("*", function (req, res, next) {
            if (this.processorOptions.hydraOperations) {
                if (!this.processorOptions.hydraOperations.indexOf('DELETE')) return res.sendStatus(404);

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

        /**
         * Fallback
         */
        this.get("*", function (req, res, next) {
            res.json(populateIndex(processorOptions,req));
        });

    }
}

/**
 * Gets the index.json file and populates it with additional info such as files.
 */
function populateIndex(processorOptions, req) {
    let baseUri = resolve.base(req);
    let localDir = resolve.publicToLocal(resolve.base(req), req);

    // Read the index
    let result = fu.readJson(localDir + '/' + processorOptions.indexFile);

    result["@id"] = baseUri;
    let contents = fu.readDir(localDir);

    // Process directories
    if (processorOptions.showDirectories) {
        _.map(contents.directories,
            directory => {
                // Peek types
                let directoryIndex = fu.readJson(localDir + "/" + directory + '/' + processorOptions.indexFile);
                let type = _.get(directoryIndex, '@type', 'this:Resource');
                result["this:" + directory] = buildLink(baseUri + "/" + directory, type)
            }
        );
    }

    // Process files
    if (processorOptions.showFiles) {
        function getPublicFiles(files) {
            return _.map(files.filter(filePath => !filePath.endsWith(processorOptions.indexFile)),
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

    // Process meta
    if (result['meta:operation']) {
        let operations = [], currentOperation;

        // Handle build links for the operations
        for (currentOperation of _.filter(result['meta:operation'])) {
            let operationName = _.get(currentOperation, 'operation');
            let operationUri = baseUri + '/' + operationName + '/execute';
            let link = buildLink(operationUri, 'Operation');
            if (currentOperation.description) {
                link['this:description'] = currentOperation.description;
            }
            operations.push(link);
        }
        delete result['meta:operation'];
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

function body2JsonLD(body) {
    let n3Parser = new N3Parser();
    let jsonLd = n3Parser.toJSONLD(body);
    let eyeResponse = JSON.stringify(jsonLd, null, 4);
    return JSON.parse(eyeResponse);
}

function getEye(operation, localDir) {
    function getInput(input) {
        return _.flatMap(_.get(operation, input), currentPath => resolve.specToPublic(localDir, currentPath));
    }

    let data = _.flatten([getInput('input.data'), getInput('input.n3'), getInput('input.turtle')]);
    let query = getInput('input.query');

    if (query.length !== 1) {
        throw Error("Only one query at a time is supported")
    }

    return reasoning.eyePromise(data, query[0]);
}

module.exports = HES;