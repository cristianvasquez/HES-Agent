const config = require('../config');
const fs = require('fs-extra');
const path = require('path');
var glob = require("glob");


function exists(fileOrDir) {
    return fs.existsSync(fileOrDir);
}
exports.exists = exists;

function isFile(fileOrDir){
    return !fs.statSync(fileOrDir).isDirectory();
}
exports.isFile = isFile;

function isDirectory(fileOrDir){
    return fs.statSync(fileOrDir).isDirectory();
}
exports.isDirectory = isDirectory;

/**
 * All the files from a public directory
 */
function getFiles(localDir) {
    if (!exists(localDir)){
        return [];
    }
    return fs.readdirSync(localDir);
}
exports.getFiles = getFiles;


/**
 * All the files and directories from a public directory
 */
function readDir(dir) {

    if (!exists(dir)){
        return {
            exists:false
        }
    }

    let result = {
        files:[],
        directories:[],
        exists:true,
        isDirectory:fs.statSync(dir).isDirectory()
    };

    if (result.isDirectory){
        let elements = fs.readdirSync(dir);
        elements.forEach(function(file) {
            if (fs.statSync(dir + '/' + file).isDirectory()) {
                result.directories.push(file);
            }
            else {
                result.files.push(path.resolve(dir+"/"+file));
            }
        });
    }

    return result;
}
exports.readDir = readDir;




/**
 * Gets the index.json file from a local directory
 */
function readJson(filePath){
    if (exists(filePath)){
        let contents = fs.readFileSync(filePath);
        try {
            return JSON.parse(contents);
        } catch (e) {
            throw new Error(e+' ['+filePath+']');
        }
    } else {
        return {
            "@context": config.defaultContext
        }
    }
}
exports.readJson = readJson;

/**
 * Write a file to a local directory
 */
function writeFile(filepath,text){
    return fs.outputFile(filepath,text);
}
exports.writeFile = writeFile;

/**
 * Creates a new Dataspace
 */
exports.copyDirectory = function(sourceDir,targetDir){
    fs.copySync(sourceDir, targetDir);
    return targetDir;
};

exports.deleteFileOrDirectory = function(localDir){
    fs.removeSync(localDir);
};

module.exports = exports;