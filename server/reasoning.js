const config = require('../config');
const exec = require('child-process-promise').exec;

function eyePromise(inference) {
    return invokeEye(getEyeCommand(inference), false);
}

/**
 * Build up a command for eye, from an expanded inference description
 */
function getEyeCommand(inference){
    let command = config.defaultEyeOptions.eyePath;

    /**
     * Handle flags
     */
    let flags = config.defaultEyeOptions.defaultFlags.join(" ");
    if (inference['hes:options']){
        if (inference['hes:options']["hes:proof"]){
            flags = "";
        }
    } else if (inference['eye:flags']){
        if (Array.isArray(inference['eye:flags'])){
            flags = flags+" "+inference['eye:flags'].join(" ");
        } else {
            flags = flags+" "+inference['eye:flags'];
        }
    }
    command=command+" "+flags;

    /**
     * Handle data
     */
    if (inference['hes:data']){
        // command = command+" --data "+inference['hes:data']['hes:href'].join(" ");
        if (Array.isArray(inference['hes:data']['hes:href'])){
            command = command+" "+inference['hes:data']['hes:href'].join(" ");
        } else {
            command = command+" "+inference['hes:data']['hes:href'];
        }
    }

    /**
     * Handle query
     */
    if (inference['hes:query']){
        if (Array.isArray(inference['hes:query']['hes:href'])){
            if (inference['hes:query']['hes:href'].length===1){
                command = command+" --query "+inference['hes:query']['hes:href'][0];
            }else {
                throw new Error('cannot handle multiple queries');
            }
        } else {
            command = command+" --query "+inference['hes:query']['hes:href'];
        }
    }

    /**
     * Handle proof
     */
    // proof only supports urls by the moment
    if (inference['hes:proof']){
        if (!inference['hes:proof']['hes:href']) {
            throw new Error('hes:href for proof not specified');
        }
        if (Array.isArray(inference['hes:proof']['hes:href'])){
            command = command+" --proof "+inference['hes:proof']['hes:href'].join(" --proof ");
        } else {
            command = command+" --proof "+inference['hes:proof']['hes:href'];
        }
    }

    return command;
}

function invokeEye(command, fullOutput = true) {

    return new Promise(function(resolve, reject) {

        if (config.serverOptions.verbose){
            console.log(command);
        }

        exec(command, config.defaultEyeOptions.command_arguments)
            .then(function (result) {
                let stdout = result.stdout;
                let stderr = result.stderr;

                // EYE do not show signature as usual.
                if (!stderr.match(eyeSignatureRegex)){
                    reject({
                        "stdout":result.stdout,
                        "stderr":result.stderr,
                        "error": 'No match for EYE signature'
                    });
                }

                // An error detected
                let errorMatch = stderr.match(errorRegex);
                if (errorMatch){
                    reject({
                        "stdout":result.stdout,
                        "stderr":result.stderr,
                        "error":errorMatch
                    });
                }

                if (fullOutput){
                    resolve({
                        "stdout":result.stdout,
                        "stderr":result.stderr
                    })
                } else {
                    resolve(clean(stdout));
                }
            })
            .catch(function (err) {
                console.error("Command line exception :"+err);
                reject({
                    "error":err
                });
            });
    });
}

// taken from https://github.com/RubenVerborgh/EyeServer
const commentRegex = /^#.*$\n/mg,
    prefixDeclarationRegex = /^@prefix|PREFIX ([\w\-]*:) <([^>]+)>\.?\n/g,
    eyeSignatureRegex = /^(Id: euler\.yap|EYE)/m,
    errorRegex = /^\*\* ERROR \*\*\s*(.*)$/m;

// taken from https://github.com/RubenVerborgh/EyeServer
function clean(n3) {
    // remove comments
    n3 = n3.replace(commentRegex, '');

    // remove prefix declarations from the document, storing them in an object
    let prefixes = {};
    n3 = n3.replace(prefixDeclarationRegex, function (match, prefix, namespace) {
        prefixes[prefix] = namespace.replace(/^file:\/\/.*?([^\/]+)$/, '$1');
        return '';
    });

    // remove unnecessary whitespace from the document
    n3 = n3.trim();

    // find the used prefixes
    let prefixLines = [];
    for (let prefix in prefixes) {
        let namespace = prefixes[prefix];

        // EYE does not use prefixes of namespaces ending in a slash (instead of a hash),
        // so we apply them manually
        if (namespace.match(/\/$/))
        // warning: this could wreck havoc inside string literals
            n3 = n3.replace(new RegExp('<' + escapeForRegExp(namespace) + '(\\w+)>', 'gm'), prefix + '$1');

        // add the prefix if it's used
        // (we conservatively employ a wide definition of "used")
        if (n3.match(prefix))
            prefixLines.push("PREFIX ", prefix, " <", namespace, ">\n");
    }

    // join the used prefixes and the rest of the N3
    return !prefixLines.length ? n3 : (prefixLines.join('') + '\n' + n3);
}

function escapeForRegExp(text) {
    return text.replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g, "\\$&");
}

module.exports = {
    getEyeCommand:getEyeCommand,
    eyePromise:eyePromise,
    invokeEye:invokeEye
};
