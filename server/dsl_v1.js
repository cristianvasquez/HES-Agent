const serverOptions = require("../config").serverOptions;
const fu = require("./persistence");
const _ = require('lodash');
const validUrl = require('valid-url');
const path = require('path');

/**
 * First layer
 *
 * Expand relative files
 * Expand directories
 */

function expandMeta(dirRelativeTo, meta) {
    if (meta['hes:query']) {
        return meta;
    } else if (meta["hes:href"]) {
        return expandHref(dirRelativeTo, meta);
    } else if (meta["hes:inference"]) {
        return expandInference(dirRelativeTo, meta);
    } else if (meta["hes:extends"]) {
        return expandExtends(dirRelativeTo, meta);
    }
    throw Error("I don't know how to interpret:" + toJson(meta));
}

function expandHref(dirRelativeTo, meta) {
    meta["hes:href"] = normalizeHref(dirRelativeTo, meta["hes:href"]);
    return meta;
}

function expandInference(dirRelativeTo, meta) {
    let inference = meta["hes:inference"];

    // Expand query
    if (!inference['hes:query']['hes:raw'] && !inference['hes:query']['hes:href']) {
        throw Error("Query needs to be defined in " + toJson(inference));
    }
    if (inference['hes:query']['hes:href']) {
        inference['hes:query']['hes:href'] = normalizeHref(dirRelativeTo, inference['hes:query']['hes:href']);
    }
    // Expand data
    if (!inference['hes:data']['hes:raw'] && !inference['hes:data']['hes:href']) {
        throw Error("Data needs to be defined in " + toJson(inference));
    }
    if (inference['hes:data']['hes:href']) {
        let href = inference['hes:data']['hes:href'];
        // One value
        if (typeof href === 'string') {
            inference['hes:data']['hes:href'] = expandDirectories(normalizeHref(dirRelativeTo, href));
        } else {
            // Array of values
            inference['hes:data']['hes:href'] = _.flatMap(href, href => {
                return expandDirectories(normalizeHref(dirRelativeTo, href));
            });
        }

    }
    meta["hes:inference"] = inference;
    return meta;
}

function expandExtends(dirRelativeTo, meta) {
    if (!meta["hes:extends"]['hes:href']) throw new Error('No href in extends ' + toJson(meta));
    let operation = findOperation(dirRelativeTo, meta["hes:extends"]['hes:href'], meta["hes:extends"]['hes:name']);
    if (operation['hes:inference']) {

        /**
         * It's not clear yet how I will represent Set, Union, Intersection etc.
         */
        meta['hes:inference'] = {};

        // If data is defined, maintains it
        if (meta['hes:extends']['hes:data']) {
            meta['hes:inference']['hes:data'] = meta['hes:extends']['hes:data'];
        } else {
            meta['hes:inference']['hes:data'] = operation['hes:inference']['hes:data'];
        }

        // If query is defined, maintains it.
        if (meta['hes:extends']['hes:query']) {
            meta['hes:inference']['hes:query'] = meta['hes:extends']['hes:query'];
        } else {
            meta['hes:inference']['hes:query'] = operation['hes:inference']['hes:query'];
        }

        delete meta['hes:extends'];

        return expandInference(dirRelativeTo, meta);
    }
    // its other kind of operation
    return expandMeta(dirRelativeTo, meta);
}

function findOperation(dirRelativeTo, href, name) {
    let targetDir = normalizeHref(dirRelativeTo, href);
    // Gets the template
    let index = fu.readJson(targetDir + '/' + serverOptions.indexFile);
    if (!fu.exists(targetDir + '/' + serverOptions.indexFile)) {
        throw new Error("Could not find index in " + targetDir + '/' + serverOptions.indexFile);
    }
    if (index['hes:meta']) {
        for (let operation of index['hes:meta']) {
            if (operation['hes:name'] === name) {
                // returns the expanded operation
                // @TODO handle circular. (stack overflow or something like that)
                return expandMeta(targetDir, operation);
            }
        }
    }
    throw new Error("Could not find operation name " + name + ' in ' + href);
}

function validateMeta(meta) {
    if (meta['hes:inference']){
        if(Array.isArray(meta['hes:inference']['hes:data'])){
            console.error('array not allowed in '+toJson(meta));
            return false;
        }
    }
    if (meta['hes:extends']){
        if(Array.isArray(meta['hes:extends']['hes:data'])){
            console.error('array not allowed in '+toJson(meta));
            return false;
        }
    }
    return true;
}

function expandDirectories(href) {
    if (validUrl.is_web_uri(href)) { // other uri resources
        return [href]
    }
    let files = fu.readDir(href).files;
    if (!files) {
        let errorMessage = "404 [" + href + "]";
        throw Error(errorMessage);
    }
    return files.filter(x => !x.endsWith(serverOptions.indexFile));
}

/**
 * Second layer
 *
 * Expand eye options
 */

function getEyeOptions(localDir, inference) {
    // "hes:data": {
    //     "hes:href": [
    //         config.serverOptions.workSpacePath+"/lib/data/knowledge.n3",
    //         config.serverOptions.workSpacePath+"/lib/data/socrates.n3"
    //     ]
    // },
    // "hes:query": {
    //     "hes:href": config.serverOptions.workSpacePath+"/lib/query/whoIsWhat.n3"
    // }
    return {
        data: inference['hes:data']['hes:href'],
        query: inference['hes:query']['hes:href'],
        flags: inference['eye:flags']
    };
}


/**
 * Handles a defined href, in case of having a corresponding local path, returns it.
 */

function normalizeHref(dirRelativeTo, value) {
    if (typeof value !== 'string') {
        throw Error("I don't know how to handle href: " + value);
    }
    if (value.startsWith(serverOptions.workSpacePath)) {
        return path.resolve(value);
    } else if (value.startsWith('.')) { // Relative path
        return path.join(dirRelativeTo, value);
    } else if (serverOptions.allowServeOutsideWorkspace && value.startsWith('/')) { // HES is NOT a secure application right now :)
        return path.resolve(serverOptions.workSpacePath + "/" + value);
    }
    throw Error("I don't know how to handle href: " + value);
}

function toJson(x) {
    return JSON.stringify(x, null, 2);
}

module.exports = {
    expandDirectories: expandDirectories,
    normalizeHref: normalizeHref,
    getEyeOptions: getEyeOptions,
    expandMeta: expandMeta,
    validateMeta: validateMeta
};
