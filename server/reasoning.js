var config = require('../config');
var exec = require('child-process-promise').exec;

/**
 * The eye options
 *
 * Usage: eye <options>* <data>* <query>*
 <options>
     --carl				use external carl parser
     --curl-http-header <field>	to pass HTTP header <field> to curl
     --debug				    output debug info on stderr
     --debug-cnt			    output debug info about counters on stderr
     --debug-djiti			    output debug info about DJITI on stderr
     --debug-pvm			    output debug info about PVM code on stderr
     --help				        show help info
     --hmac-key <key>		    HMAC key
     --ignore-inference-fuse	do not halt in case of inference fuse
     --ignore-syntax-error		do not halt in case of syntax error
     --image <pvm-file>		output all <data> and all code to <pvm-file>
     --license			show license info
     --multi-query			query answer loop
     --n3p				output all <data> as N3 P-code on stdout
     --no-distinct-input		no distinct triples in the input
     --no-distinct-output		no distinct answers in the output
     --no-genid			no generated id in Skolem IRI
     --no-numerals			no numerals in the output
     --no-qnames			no qnames in the output
     --no-qvars			no qvars in the output
     --no-skolem <prefix>		no uris with <prefix> in the output
     --nope				no proof explanation
     --pass-all-ground		ground the rules and run --pass-all
     --pass-only-new			output only new derived triples
     --pass-turtle			output the --turtle data
     --probe				output speedtest info on stderr
     --profile			output profile info on stderr
     --random-seed			create random seed
     --rule-histogram		output rule histogram info on stderr
     --source <file>			read command line arguments from <file>
     --statistics			output statistics info on stderr
     --streaming-reasoning		streaming reasoning on --turtle data
     --strict			strict mode
     --strings			output log:outputString objects on stdout
     --tactic existing-path		Euler path using homomorphism
     --tactic limited-answer <count>	give only a limited number of answers
     --tactic limited-brake <count>	take only a limited number of brakes
     --tactic limited-step <count>	take only a limited number of steps
     --tactic linear-select		select each rule only once
     --traditional			traditional mode
     --version			show version info
     --warn				output warning info on stderr
     --wcache <uri> <file>		to tell that <uri> is cached as <file>
 <data>
     --n3 <uri>			N3 triples and rules
     --plugin <uri>			N3P code
     --proof <uri>			N3 proof
     --turtle <uri>			Turtle data
 <query>
     --pass				output deductive closure
     --pass-all			output deductive closure plus rules
     --query <n3-query>		output filtered with filter rules
 */

function eyePromise(data,query) {
    return invokeEye(config.eyePath+" --nope "+data.join(" ")+" --query "+query, false);
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
    invokeEye:invokeEye
};
