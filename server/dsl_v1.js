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
    let targetDir = normalizeHref(dirRelativeTo, meta["hes:extends"]['hes:href']);
    let operation = findOperation(targetDir, meta["hes:extends"]['hes:name']);
    if (operation['hes:inference']) {

        /**
         * It's not clear yet how I will represent Set, Union, Intersection etc.
         */
        meta['hes:inference'] = {};
        function overrideIfExisting(parameter){
            // If parameter is defined, maintains it
            if (meta['hes:extends'][parameter]) {
                meta['hes:inference'][parameter] = meta['hes:extends'][parameter];
            } else {
                if (operation['hes:inference'][parameter]){
                    meta['hes:inference'][parameter] = operation['hes:inference'][parameter];
                }
            }
        }
        overrideIfExisting('hes:data');
        overrideIfExisting('hes:query');
        overrideIfExisting('hes:options');
        overrideIfExisting('hes:flags');
        overrideIfExisting('hes:Accept');

        delete meta['hes:extends'];

        return expandInference(dirRelativeTo, meta);
    }
    // its other kind of operation
    return expandMeta(dirRelativeTo, meta);
}

function findOperation(targetDir, name) {
    // Gets the template
    let index = fu.readJson(targetDir + '/' + serverOptions.indexFile);
    if (!fu.exists(targetDir + '/' + serverOptions.indexFile)) {
        throw new Error("Could not find index in " + targetDir + '/' + serverOptions.indexFile);
    }
    if (index['hes:meta']) {
        for (let operation of index['hes:meta']) {
            if (operation['hes:name'] === name) {
                // returns the expanded operation
                // Handle circular?
                return expandMeta(targetDir, operation);
            }
        }
    }
    throw new Error("Could not find operation name " + name + ' in ' + targetDir);
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
        let join =  path.join(serverOptions.workSpacePath, value);
        // sometimes, when handling extends, the href is already expanded.
        if (fu.exists(join)){
            return join;
        } else {
            return value;
        }
    }
    throw Error("I don't know how to handle href: " + value);
}

function toJson(x) {
    return JSON.stringify(x, null, 2);
}

module.exports = {
    expandDirectories: expandDirectories,
    normalizeHref: normalizeHref,
    expandMeta: expandMeta,
    validateMeta: validateMeta
};
