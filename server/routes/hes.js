const serverOptions = require("../../config").serverOptions;
const express = require("express");
const fu = require("../persistence");
const _ = require('lodash');
const N3Parser = require('../lib/N3Parser/N3Parser');
const JSONLDParser = require('../lib/N3Parser/JSONLDParser');

const Context = require("../Context");
const reasoner = require("../reasoning");
const DSL_V1 = require("../dsl_v1");
const rp = require('request-promise');
let hash = require('string-hash');

class HES extends express.Router {

    constructor(processorOptions) {
        super();

        if (!processorOptions) {
            throw new Error("must define processor options example: " + JSON.stringify(config.processorOptions, null, 2));
        }

        this.processorOptions = processorOptions;

        /**
         * Some operations (I don't have a clear idea yet of which ones to support)
         */
        if (this.processorOptions.hydraOperations.indexOf('POST')!==-1) {
            this.post("*", function (req, res, next) {
                addOrReplace(req,res,next);
            });
        }

        if (this.processorOptions.hydraOperations.indexOf('PUT')!==-1) {
            this.put("*", function (req, res, next) {
                addOrReplace(req,res,next);
            });
        }

        function addOrReplace(req, res, next) {
            if (_.endsWith(req.originalUrl, '.ttl')){
                addOrReplaceFile(req,res,next);
            } else {
                addOrReplaceOperation(req,res,next)
            }
        }

        function addOrReplaceFile(req,res,next){
            let context = new Context(req);
            let targetFile = context.getLocalDir();
            fu.writeFile(targetFile,req.body);
            res.json({'@id':context.getCurrentPath()});
        }

        function addOrReplaceOperation(req, res, next) {

            let context = new Context(req);
            let targetDir = context.getTail().getLocalDir();
            let targetName = context.getHead();

            // check if there is a descriptor file
            let indexPath = targetDir + '/' + serverOptions.indexFile;
            if (!fu.exists(indexPath)){
                res.status(400).json({error: context.getCurrentPath()+' has no descriptor file'});
            }

            // check if payload is valid
            let newOperation = req.body;
            let valid = DSL_V1.validateCrudOperation(newOperation);
            if (!valid) {
                res.status(400).json({error: JSON.stringify(DSL_V1.validateCrudOperation.errors,null,2)});
            }

            // get the meta descriptions
            let index = fu.readJson(indexPath);
            let meta = index['hes:meta'];

            // First time a meta is defined
            if (!meta){
                meta = [];
            }
            // Remove existing operation with this name.
            meta = meta.filter(x=>x['hes:name']!==targetName);

            if (!newOperation['hes:imports']['@id']) {
                res.status(400).json({error: "cannot find ['hes:imports']['@id']"});
            }

            // Only hes:imports implemented at the moment
            let targetContext = context.getContextForURL(newOperation['hes:imports']['@id']);
            let _operation = DSL_V1.findOperation(targetContext.getTail().getLocalDir(), targetContext.getHead());
            if (!_operation.exists){
                res.status(400).json({error: "cannot find operation at: "+ newOperation['hes:imports']['@id']});
            }

            // Add the name of the operation, and the name of imported operation
            newOperation['hes:imports']['hes:name'] = targetContext.getHead();
            newOperation['hes:imports']['hes:href'] = targetContext.getTail().getLocalHref();
            delete newOperation['hes:imports']['@id'];
            newOperation['hes:name'] = targetName;

            // Add the operation
            meta.push(newOperation);
            index['hes:meta']=meta;

            fu.writeFile(indexPath,JSON.stringify(index,null,2));
            res.json({'@id':context.getCurrentPath()});
        }

        /**
         * Delete (at he moment, it only deletes operations inside a descriptor file)
         */
        if (this.processorOptions.hydraOperations.indexOf('DELETE')!==-1) {
            this.delete("*", function (req, res, next) {
                let context = new Context(req);
                if (_.endsWith(req.originalUrl, '.ttl')){

                    // Delete a turtle file
                    let targetFile = context.getLocalDir();
                    fu.deleteFileOrDirectory(targetFile);
                    res.json({ deleted: {'@id':context.getCurrentPath()}});

                } else {

                    // Delete an operation
                    let targetDir = context.getTail().getLocalDir();
                    let targetName = context.getHead();

                    // check if there is a descriptor file
                    let indexPath = targetDir + '/' + serverOptions.indexFile;
                    if (!fu.exists(indexPath)){
                        res.status(400).json({error: context.getCurrentPath()+' has no descriptor file'});
                    }

                    // Remove existing operation with this name.
                    let index = fu.readJson(indexPath);

                    if (!index['hes:meta']){
                        res.status(400).json({error: context.getCurrentPath()+' has no meta-operations defined'});
                    }
                    index['hes:meta'] = index['hes:meta'].filter(x=>x['hes:name']!==targetName);

                    fu.writeFile(indexPath,JSON.stringify(index,null,2));
                    res.json({ deleted: {'@id':context.getCurrentPath()}});
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

const validUrl = require('valid-url');
function handleHref(context, value, contentType) {
    if (!contentType){
        contentType="text/turtle";
    }
    if (validUrl.is_web_uri(value)) { // external API
        let options = {
            uri: value,
            headers: {
                "Accept": contentType
            }
        };
        return {
            isVirtual: true,
            callback: function (res) {
                rp(options)
                    .then(function (body) {
                        if (contentType==='application/x-json+ld'){
                            jsonMediaType(context,body,res);
                        } else {
                            res.writeHead(200, { 'Content-Type': contentType });
                            res.end(body, 'utf-8');
                        }
                    })
                    .catch(function (error) {
                        renderError(res,error);
                    });
            }
        };

    } else { // Internal Href
        let target = DSL_V1.toAbsolutePath(context.getTail().getLocalDir(), value);
        return {
            isVirtual: true,
            callback: function (res) {
                res.redirect(context.toApiPath(target));
            }
        }
    }
}

function handleRaw(context, value, contentType) {
    if (!contentType){
        contentType="text/turtle";
    }
    return {
        isVirtual: true,
        callback: function (res) {
            if (contentType==='application/x-json+ld'){
                jsonMediaType(context,value,res);
            } else {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(value, 'utf-8');
            }
        }
    }
}

// "hes:query": {
//     "hes:endpoint": "http://dbpedia.restdesc.org/",
//     "hes:defaultGraph": "http://dbpedia.org",
//     "hes:raw": "CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o } limit 10",
//     "hes:output": "text/turtle"
// }
function handleQuery(context, query, contentType) {
    let options = {
        uri: query['hes:endpoint'],
        qs: {
            query: query['hes:raw'],
            "default-graph-uri": query['hes:default-graph-uri']
        },
        headers: {
            "Accept": "text/turtle"
        }
    };
    return {
        isVirtual: true,
        callback: function (res) {
            rp(options)
                .then(function (body) {
                    if (contentType==='application/x-json+ld'){
                        jsonMediaType(context,body,res);
                    } else {
                        res.writeHead(200, { 'Content-Type': contentType });
                        res.end(body, 'utf-8');
                    }
                })
                .catch(function (error) {
                    renderError(res,error);
                });
        }
    };
}

function rawToUrl(context, rawValue) {
    let filename = hash(rawValue)+".ttl";
    if (!fu.exists(filename)){
        fu.writeFile(serverOptions.workSpacePath + "/" + serverOptions.tmpFolder + "/" + filename, rawValue);
    }
    return context.getResourcesRoot() + "/" + serverOptions.tmpFolder + "/"+filename;
}

function jsonMediaType(context, body, res) {
    let result = turtle2JsonLD(body);
    result["@id"] = context.getCurrentPath();
    res.json(result);
}

function handleInference(context, inference, contentType) {

    // Writes a temporary file to be read by Eye
    if (inference['hes:query']['hes:raw']) {
        inference['hes:query']['hes:href'] = rawToUrl(context, inference['hes:query']['hes:raw']);
        delete inference['hes:query']['hes:raw'];
    }

    // We found a inference operation, we invoke the eye reasoner
    if (!contentType){
        contentType='application/x-json+ld';
    }

    return {
        isVirtual: true,
        callback: function (res) {
            Promise.resolve(reasoner.eyePromise(inference))
                .then(function (body) {
                    if (contentType==='application/x-json+ld'){
                        jsonMediaType(context,body,res);
                    } else {
                        res.writeHead(200, { 'Content-Type': contentType });
                        res.end(body, 'utf-8');
                    }
                })
                .catch(function (error) {
                    renderError(res,error);
                });
        }
    };
}

function renderError(res,error){
    let jsonError = {
        "error": error.message,
        "error.status" : error.status,
        "error.stack" : error.stack
    };
    res.status(500).json(jsonError);
    console.error(JSON.stringify(jsonError,null,2));
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
    // Expands operations and transform extends to regular operations
    let dsl_v1 = new DSL_V1(context);
    let _operation = dsl_v1.expandMeta(context.getTail().getLocalDir(),operation);
    let contentType =  _operation['hes:Content-Type'];

    if (_operation['hes:href']) {
        return handleHref(context, _operation['hes:href'], contentType)
    } else if (_operation['hes:raw']) {
        return handleRaw(context, _operation['hes:raw'],contentType)
    } else if (_operation['hes:inference']) {
        return handleInference(context, _operation['hes:inference'],contentType);
    } else if (_operation['hes:query']) {
        return handleQuery(context, _operation['hes:query'],contentType);
    }
    throw new Error("Cannot handle " + toJson(_operation));
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
            if (currentOperation['hes:description']) {
                link['hes:description'] = currentOperation['hes:description'];
            }
            operations.push(link);
        }
        delete result['hes:meta'];
        result['this:operation'] = operations;
    }

    if (processorOptions.hydraOperations) {
        result["this:operations"] = processorOptions.hydraOperations;
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

function turtle2JsonLD(body) {
    let n3Parser = new N3Parser();
    let jsonLd = n3Parser.toJSONLD(body);
    let eyeResponse = JSON.stringify(jsonLd, null, 4);
    return JSON.parse(eyeResponse);
}

function jsonld2Turtle(body) {
    let jsonLdParser = new JSONLDParser();
    return jsonLdParser.toN3(body);
}

module.exports = HES;