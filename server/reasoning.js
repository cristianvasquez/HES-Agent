const config = require('../config');
const exec = require('child-process-promise').exec;

/**
 * The eye options
 *
 * Usage: eye <options>* <data>* <query>*
*/

function collect(val, memo) {
    memo.push(val);
    return memo;
}

function optionsFromCommand(src){
    let program = new require('commander');
    program.setMaxListeners(0);

    program
        .option('--carl', 'use external carl parser')
        .option('--curl-http-header <field>', 'to pass HTTP header <field> to curl')
        .option('--debug', 'output debug info on stderr')
        .option('--debug-cnt', 'output debug info about counters on stderr')
        .option('--debug-djiti', 'output debug info about DJITI on stderr')
        .option('--debug-pvm', 'output debug info about PVM code on stderr')
        .option('--help', 'show help info')
        .option('--hmac-key <key>', 'HMAC key')
        .option('--ignore-inference-fuse', 'do not halt in case of inference fuse')
        .option('--ignore-syntax-error', 'do not halt in case of syntax error')
        .option('--image <pvm-file>', 'output all <data> and all code to <pvm-file>')
        .option('--license', 'show license info')
        .option('--multi-query', 'query answer loop')
        .option('--n3p', 'output all <data> as N3 P-code on stdout')
        .option('--no-distinct-input', 'no distinct triples in the input')
        .option('--no-distinct-output', 'no distinct answers in the output')
        .option('--no-genid', 'no generated id in Skolem IRI')
        .option('--no-numerals', 'no numerals in the output')
        .option('--no-qnames', 'no qnames in the output')
        .option('--no-qvars', 'no qvars in the output')
        .option('--no-skolem <prefix>', 'no uris with <prefix> in the output')
        .option('--nope', 'no proof explanation')
        .option('--pass-all-ground', 'ground the rules and run --pass-all')
        .option('--pass-only-new', 'output only new derived triples')
        .option('--pass-turtle', 'output the --turtle data')
        .option('--probe', 'output speedtest info on stderr')
        .option('--profile', 'output profile info on stderr')
        .option('--random-seed', 'create random seed')
        .option('--rule-histogram', 'output rule histogram info on stderr')
        .option('--source <file>', 'read command line arguments from <file>')
        .option('--statistics', 'output statistics info on stderr')
        .option('--streaming-reasoning', 'streaming reasoning on --turtle data')
        .option('--strict', 'strict mode')
        .option('--strings', 'output log:outputString objects on stdout')
        .option('--tactic existing-path', 'Euler path using homomorphism')
        .option('--tactic limited-answer <count>', 'give only a limited number of answers')
        .option('--tactic limited-brake <count>', 'take only a limited number of brakes')
        .option('--tactic limited-step <count>', 'take only a limited number of steps')
        .option('--tactic linear-select', 'select each rule only once')
        .option('--traditional', 'traditional mode')
        .option('--version', 'show version info')
        .option('--warn', 'output warning info on stderr')
        .option('--wcache <uri> <file>', 'to tell that <uri> is cached as <file>')
        // <data>
        .option('--n3 [value]', 'N3 triples and rules', collect, [])
        .option('--plugin [value]', 'N3P code', collect, [])
        .option('--proof [value]', 'N3 proof', collect, [])
        .option('--turtle [value]', 'Turtle data', collect, [])
        // <query>
        .option('--pass', 'output deductive closure')
        .option('--pass-all', 'output deductive closure plus rules')
        .option('--query <n3-query>', 'output filtered with filter rules');

    // distinctInput = true
    // distinctOutput = true
    // genid = true
    // n3 = Array(1)
    // numerals = true
    // plugin = Array(0)
    // proof = Array(0)
    // qnames = true
    // query = "http://josd.github.io/fluid/3outof5/query.n3"
    // qvars = true
    // skolem = true
    // turtle = Array(0)

    let cmd = src.replace('>',' > ').split(' ').filter(x=>x!=='');
    // console.log(' cmd: %j', cmd);
    program.parse(cmd);

    if (program.args[0]==='>'){
        console.log(' cmd: %j', src);
        console.log(' output: %j', program.args[1]);
    }

    let result = {
        n3:program.n3
    }

    // console.log(' n3: %j', program.n3);
    // console.log(' plugin: %j', program.plugin);
    // console.log(' proof: %j', program.proof);
    // console.log(' turtle: %j', program.turtle);
    // console.log(' query: %j', program.query);

    // program.__proto__.removeAllListeners();
    delete program;
}

function eyePromise(data,query) {
    return invokeEye(config.defaultEyeOptions.eyePath+" --nope "+data.join(" ")+" --query "+query, false);
}

function invokeEye(command, get_all = true) {

    return new Promise(function(resolve, reject) {
        console.debug("[eye] "+command);
        exec(command)
            .then(function (result) {

                if (get_all){
                    resolve({
                        "stdout":result.stdout,
                        "stderr":result.stderr
                    })
                }

                let stdout = result.stdout;
                let stderr = result.stderr;

                if (!stderr.match(eyeSignatureRegex)){
                    reject(stderr);
                }

                let errorMatch = stderr.match(errorRegex);
                if (errorMatch){
                    reject(errorMatch[1]);
                }

                resolve(clean(stdout));

            })
            .catch(function (err) {
                reject(err.message);
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
    eyePromise:eyePromise,
    invokeEye:invokeEye,
    optionsFromCommand:optionsFromCommand
};
