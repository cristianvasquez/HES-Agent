var config = require('../config');
var fs = require('fs-extra')
var path = require('path');

var exports = [];

function exists(localDir) {
    return fs.existsSync(localDir);
};
exports.exists = exists;

/**
 * All the files from a public directory
 */
function getFiles(localDir) {
    if (!exists(localDir)){
        return [];
    }
    return fs.readdirSync(localDir);
};
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
        exists:true
    };

    if (fs.statSync(dir).isDirectory()){
        var elements = fs.readdirSync(dir);
        elements.forEach(function(file) {
            if (fs.statSync(dir + '/' + file).isDirectory()) {
                result.directories.push(file);
            }
            else {
                result.files.push(path.resolve(dir+"/"+file));
            }
        });
    } else {
        result.files.push(dir)
    }

    return result;
};
exports.readDir = readDir;

/**
 * Gets the index.json file from a local directory
 */
function readJson(filePath){
    if (exists(filePath)){
        var contents = fs.readFileSync(filePath);
        return JSON.parse(contents);
    } else {
        return {
            "@context": config.defaultContext
        }
    }
};
exports.readJson = readJson;

// function readRequired(filePath){
//     if (exists(filePath)){
//         var contents = fs.readFileSync(filePath);
//         return JSON.parse(contents);
//     } else {
//         throw new Error(filePath+" does not exist")
//     }
// };
// exports.readRequired = readRequired;

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

exports.deleteDirectory = function(localDir){
    fs.removeSync(localDir);
};

module.exports = exports;

