/**
 * Created by joachimvh on 8/12/2015.
 */

var N3Lexer = require('./N3Lexer');
var Util = require('./Util');
var uuid = require('uuid');
var _ = require('lodash');

function N3Parser () {}

N3Parser.BASE = Util.BASE;

N3Parser.prototype.toJSONLD = function (input)
{
    var lexer = new N3Lexer();
    var lex = lexer.parse(input);

    var unsafe = this._unsafePrefixes(lex, {});
    var jsonld = this._parse(lex, null, {}, unsafe);

    jsonld = this._simplify(jsonld);

    // do this before removing default graph so everything has at least 1 reference
    this._compact(jsonld);

    // default graph is not necessary if there is only 1 root node
    if (jsonld['@graph'] && jsonld['@graph'].length === 1 && _.every(jsonld, function (val, key) { return key === '@context' || key === '@graph'; }))
    {
        var child = jsonld['@graph'][0];
        delete jsonld['@graph'];
        jsonld = _.extend(jsonld, child);
    }

    return jsonld;
};

N3Parser.prototype._parse = function (lex, root, context, unsafe)
{
    if (Util.isLiteral(lex) || _.isArray(lex))
        throw 'Input should be an object.';

    var result, i;
    if (lex.type === 'Document' || lex.type === 'Formula')
    {
        result = {'@context': {}, '@graph': []};
        var newContext = {};
        for (var c in context)
            newContext[c] = context[c];

        for (i = 0; i < lex.val.length; ++i)
        {
            var statement = lex.val[i];
            if (statement.type === 'Prefix')
            {
                var uri = statement.val[1].substring(1, statement.val[1].length - 1);
                result['@context'][statement.val[0]] = uri;
                newContext[statement.val[0]] = uri;
            }
            else
                result['@graph'].push(this._parse(statement, result, newContext, unsafe));
        }
        if (result['@context'][''])
        {
            result['@context'][N3Parser.BASE] = result['@context'][''];
            delete result['@context']['']
        }
        for (var key in unsafe)
            delete result['@context'][key]; // delete unsafe keys from context to prevent confusion
        if (_.isEmpty(result['@context']))
            delete result['@context'];
    }
    else if (lex.type === 'TripleData' || lex.type === 'BlankTripleData')
    {
        var predicateObjects;
        if (lex.type === 'TripleData')
        {
            predicateObjects = lex.val[1];
            result = this._parse(lex.val[0], root, context, unsafe);
        }
        else
        {
            predicateObjects = lex.val;
            result = {};
        }
        for (i = 0; i < predicateObjects.length; ++i)
        {
            var po = predicateObjects[i];
            var predicate = this._handlePredicate(po.val[0], root, context, unsafe);
            if (!_.isString(predicate))
            {
                if ('@id' in predicate)
                    throw "Predicate shouldn't have an ID yet.";
                predicate['@id'] = '_:b_' + uuid.v4();
                if (Object.keys(predicate).length > 1) // no use adding it if it's just a blank node
                    root['@graph'].push(predicate);
                predicate = predicate['@id'];
            }
            var objects = _.map(po.val[1], function (thingy) { return this._parse(thingy, root, context, unsafe); }.bind(this));
            if (!(predicate in result))
                result[predicate] = objects;
            else
                result[predicate].push.apply(result[predicate], objects);
        }
    }
    else if (lex.type === 'List')
        result = { '@list': _.map(lex.val, function (thingy) { return this._parse(thingy, root, context, unsafe); }.bind(this)) };
    else if (lex.type === 'RDFLiteral')
    {
        var str = lex.val[0];
        var type = lex.val[1];
        var lang = lex.val[2];

        var tick = str[0];
        str = str[1] === tick ? str.substring(3, str.length-3) : str.substring(1, str.length-1);
        str = this._numericEscape(this._stringEscape(str));
        result = { '@value': str };

        if (type) result['@type'] = [this._parse(type, root, context, unsafe)]; // array to stay consistent with rest of jsonld generation
        else if (lang) result['@language'] = lang;
    }
    else if (lex.type === 'BooleanLiteral')
        result = { '@value': lex.val == 'true' || lex.val === '@true' };
    else if (lex.type === 'NumericLiteral')
        result = { '@value': parseFloat(lex.val) };
    else if (lex.type === 'Variable')
        result = { '@id' : lex.val };
    else if (lex.type === 'ExplicitIRI')
        result = { '@id': this._numericEscape(lex.val.substring(1, lex.val.length-1)) }; // remove < >
    else if (lex.type === 'PrefixedIRI')
    {
        var prefixIdx = lex.val.indexOf(':');
        var prefix = lex.val.substring(0, prefixIdx);
        if (prefix === '')
            result = { '@id': N3Parser.BASE + lex.val };
        else if (prefix === '_')
            result = { '@id': lex.val };
        else if (unsafe[prefix] && context[prefix])
            result = { '@id': context[prefix] + lex.val.substring(prefixIdx + 1) };
        else
        {
            if (!context[prefix])
                throw new Error('unknown prefix ' + prefix);
            result = { '@id': lex.val}
        }
    }
    else throw 'Unsupported type or should have been handled in one of the other cases: ' + lex.type;

    return result;
};

N3Parser.prototype._handlePredicate = function (lex, root, context, unsafe)
{
    if (Util.isLiteral(lex) || _.isArray(lex))
        throw 'Input should be an object.';

    var result;
    if (lex.type === 'ExplicitIRI' || lex.type === 'PrefixedIRI' || lex.type ==='Variable')
        result = this._parse(lex, root, context, unsafe)['@id'];
    else if (lex.type === 'SymbolicIRI')
    {
        switch (lex.val)
        {
            case '=': result = 'http://www.w3.org/2002/07/owl#equivalentTo'; break;
            case '=>': result = 'http://www.w3.org/2000/10/swap/log#implies'; break;
            case '<=': result = { '@reverse': 'http://www.w3.org/2000/10/swap/log#implies' }; break;
            case '@a':
            case 'a': result = '@type'; break;
            default: throw 'Unsupported symbolic IRI: ' + lex.val;
        }
    }
    else
        result = this._parse(lex, root, context, unsafe);

    return result;
};

// http://www.w3.org/TR/turtle/#sec-escapes
N3Parser.prototype._stringEscape = function (str)
{
    var regex = /((?:\\\\)*)\\([tbnrf"'\\])/g;
    return str.replace(regex, function (match, p1, p2)
    {
        var slashes = p1.substr(0, p1.length/2);
        var c;
        switch (p2)
        {
            case 't': c = '\t'; break;
            case 'b': c = '\b'; break;
            case 'n': c = '\n'; break;
            case 'r': c = '\r'; break;
            case 'f': c = '\f'; break;
            case '"':
            case "'":
            case '\\': c = p2; break;
            default: c = '';
        }
        return slashes + c;
    });
};

N3Parser.prototype._numericEscape = function (str)
{
    var regex = /\\[uU]([A-fa-f0-9]{4,6})/g;
    return str.replace(regex, function (match, unicode)
    {
        return String.fromCharCode(unicode);
    });
};

// Warning: will modify the context object
N3Parser.prototype._unsafePrefixes = function (lex, result, context)
{
    result = result || {};
    context = context || {};
    if (Util.isLiteral(lex) || !lex) return {};
    if (_.isArray(lex))
    {
        for (var i = 0; i < lex.length; ++i)
            this._unsafePrefixes(lex[i], result, context);
        return result;
    }

    if (lex.type === 'Prefix')
        context[lex.val[0]] = lex.val[1].substring(1, lex.val[1].length - 1);

    this._unsafePrefixes(lex.val, result, context);
    if (lex.type === 'ExplicitIRI')
    {
        var prefixIdx = lex.val.indexOf(':');
        var prefix = lex.val.substring(1, prefixIdx); // 1, since '<' is still there
        if (prefix in context && lex.val.substr(prefixIdx, 3) !== '://')
            result[prefix] = context[prefix];
    }
    return result;
};

// TODO: reserved escape

N3Parser.prototype._simplify = function (jsonld)
{
    if (Util.isLiteral(jsonld))
        return jsonld;

    if (_.isArray(jsonld))
    {
        for (var i = 0; i < jsonld.length; ++i)
            jsonld[i] = this._simplify(jsonld[i]);
        return jsonld;
    }

    var keys = Object.keys(jsonld);
    if (keys.length === 1 && keys[0] === '@value')
        return jsonld['@value'];

    for (var key in jsonld)
    {
        if (key === '@context')
        {
            if (Object.keys(jsonld[key]).length > 0)
                jsonld[key] = this._simplify(jsonld[key]);
        }
        else
        {
            var objects = this._simplify(jsonld[key]);
            if (!_.isArray(objects))
                objects = [objects];
            if (key === '@type')
                objects = _.map(objects, '@id');

            if (objects.length === 1 && key !== '@graph' && key !== '@list')
                objects = objects[0];
            jsonld[key] = objects;
        }
    }
    // this is a special case where we have literals as triples without predicates in the graph root
    if ('@graph' in jsonld)
        jsonld['@graph'] = _.map(jsonld['@graph'], function (thingy) { if (Util.isLiteral(thingy)) return { '@value': thingy}; return thingy; });

    return jsonld;
};

N3Parser.prototype._compact = function (jsonld, references)
{
    if (Util.isLiteral(jsonld) || !jsonld)
        return;
    if (_.isArray(jsonld))
        return _.each(jsonld, function (thingy) { this._compact(thingy, references); }.bind(this));

    var key;
    if ('@id' in jsonld)
    {
        var id = jsonld['@id'];
        if (id in references)
        {
            this._mergeNodes(references[id], jsonld);
            jsonld['@type'] = null;
        }
        else
            references[id] = jsonld;
    }

    // adding the predicates would only be necessary if we delete the blank node @ids
    for (key in jsonld)
    {
        this._compact(jsonld[key], key === '@graph' ? {} : references);

        if (key === '@list')
        {
            jsonld[key] = _.map(jsonld[key], function (node)
            {
                if (_.isObject(node) && node['@type'] === null)
                    return { '@id': node['@id']};
                return node;
            });
        }
        else if (_.isArray(jsonld[key]))
        {
            var acc = {};
            var list = _.filter(_.map(jsonld[key], function (node)
            {
                // can't delete if it's the only reference
                if (node['@id'] && !acc[node['@id']] && key !== '@graph')
                {
                    acc[node['@id']] = true;
                    if (node['@type'] === null)
                        return { '@id': node['@id']};
                }
                return node['@type'] === null ? null : node;
            }));
            if (list.length === 0 && key !== '@graph')      delete jsonld[key];
            else if (list.length === 1 && key !== '@graph') jsonld[key] = list[0]; // @graph always expects a list for its parameters
            else                                            jsonld[key] = list;
        }
        else if (_.isObject(jsonld[key]) && jsonld[key]['@type'] === null)
            // need to modify object in place to make sure all references are correct
            for (var subKey in jsonld[key])
                if (subKey !== '@id')
                    delete jsonld[key][subKey];
    }
};

N3Parser.prototype._mergeNodes = function (objectA, objectB)
{
    var i;
    if (_.isString(objectA) && _.isString(objectB))
        return [objectA, objectB];

    if (_.isArray(objectA) !== _.isArray(objectB))
    {
        objectA = _.isArray(objectA) ? objectA : [objectA];
        objectB = _.isArray(objectB) ? objectB : [objectB];
    }

    if (_.isArray(objectA) && _.isArray(objectB))
    {
        Array.prototype.push.apply(objectA, objectB);
        return objectA;
    }

    var idA = objectA['@id'];
    var idB = objectB['@id'];
    if (idA !== idB || (idA === undefined && idB === undefined))
        return [objectA, objectB];

    // 2 objects
    var keys = Object.keys(objectB);
    for (i = 0; i < keys.length; ++i)
    {
        var key = keys[i];
        if (key === '@id')
            continue;

        if (objectA[key] !== undefined && objectB[key] !== undefined)
            objectA[key] = this._mergeNodes(objectA[key], objectB[key]);
        else if (objectB[key] !== undefined)
            objectA[key] = objectB[key];
    }
    return objectA;
};

module.exports = N3Parser;

// :a :b :c.a:a :b :c.
// :a :b :5.E3:a :b :c.
//var parser = new N3Parser();
//var jsonld = parser.toJSONLD('_:request http:methodName "GET"; tmpl:requestURI ("http://skillp.tho.f4w.l0g.in/api/operator_skills/" ?id); http:resp [ http:body _:body ]. _:body :contains {[ :name _:name; :desc _:desc; :role _:role; :skills {[ :machine _:m; :tool _:t; :computer _:c]} ]}. ?operator :machineSkills _:m; :toolSkills _:t; :computerSkills _:c. ?operator :name _:name; :desc _:desc; :role _:role.');
//var jsonld = parser.toJSONLD('() {() () ()} ().');
//var jsonld = parser.toJSONLD('@prefix : <http://f4w.restdesc.org/demo#>. @prefix tmpl: <http://purl.org/restdesc/http-template#> . @prefix http: <http://www.w3.org/2011/http#> ._:sk15_1 http:methodName "POST". _:sk15_1 tmpl:requestURI ("http://defects.tho.f4w.l0g.in/api/reports"). _:sk15_1 http:body {_:sk16_1 :event_id 174 .   _:sk16_1 :operator_id 3 .   _:sk16_1 :solution_id 3 .   _:sk16_1 :success false.   _:sk16_1 :comment "solved!"}. :firstTry :triedAndReported _:sk17_1. :firstTry :tryNewSolution true.');
//var jsonld = parser.toJSONLD('"a"^^<xsd:int> :a _:a.');
//var jsonld = parser.toJSONLD(':a :tolerances ( {[ :min :min1; :max :max1 ]} {[ :min :min2; :max :max2 ]} ).');
//var jsonld = parser.toJSONLD('{ :a }.');
//var jsonld = parser.toJSONLD(':a :b 0, 1.');
//var jsonld = parser.toJSONLD(':toJSONLDa :b :c. :c :b :a.');
//var jsonld = parser.toJSONLD('# comment " test \n <http://test#stuff> :b "str#ing". :a :b """line 1\n#line2\nline3""". # comment about this thing');
//var jsonld = parser.toJSONLD(':a :b "a\n\rb\\"c"@nl-de.');
//var jsonld = parser.toJSONLD(':Plato :says { :Socrates :is :mortal }.');
//var jsonld = parser.toJSONLD('{ :Plato :is :immortal } :says { :Socrates :is { :person :is :mortal } . :Donald a :Duck }.');
//var jsonld = parser.toJSONLD('[:a :b]^<test> [:c :d]!<test2> [:e :f]!<test3>.');
//var jsonld = parser.toJSONLD('[:a :b] :c [:e :f].');
//var jsonld = parser.toJSONLD(':a :b 5.E3.a:a :b :c.');
//var jsonld = parser.toJSONLD('@prefix gr: <http://purl.org/goodrelations/v1#> . <http://www.acme.com/#store> a gr:Location; gr:hasOpeningHoursSpecification [ a gr:OpeningHoursSpecification; gr:opens "08:00:00"; gr:closes "20:00:00"; gr:hasOpeningHoursDayOfWeek gr:Friday, gr:Monday, gr:Thursday, gr:Tuesday, gr:Wednesday ]; gr:name "Hepp\'s Happy Burger Restaurant" .');
//var jsonld = parser.toJSONLD('@prefix ex:<http://ex.org/>. <:a> <ex:b> ex:c.');
//console.log(JSON.stringify(jsonld, null, 4));

//var fs = require('fs');
//var data = fs.readFileSync('n3/secondUseCase/proof.n3', 'utf8');
//var jsonld = parser.parse(data);

//var JSONLDParser = require('./JSONLDParser');
//var jp = new JSONLDParser();
//console.log(jp.toN3(jsonld, 'http://www.example.org/'));