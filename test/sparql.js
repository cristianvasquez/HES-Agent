var rp = require('request-promise');
// var endpoint = 'http://dbpedia.restdesc.org/';
var endpoint = 'https://dbpedia.org/sparql';


// var query = "CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o } limit 10";

var query = "select distinct ?Concept where {[] a ?Concept} LIMIT 100";
console.log("Query to " + endpoint);
console.log("Query: " + query);


var options = {
    uri: endpoint,
    qs: {
        query:query,
        "default-graph-uri":"http://dbpedia.org"
    },
    headers: {
         "Accept": "text/turtle"
    }
};

rp(options)
    .then(function (response) {
        console.log(response);
    })
    .catch(function (err) {
        // API call failed...
    });
