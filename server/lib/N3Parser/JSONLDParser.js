/**
 * Created by joachimvh on 30/06/2015.
 */

var _ = require('lodash');
var Util = require('./Util');
var format = require('util').format;
var N3Lexer = require('./N3Lexer');
var N3Parser = require('./N3Parser');

function JSONLDParser () {}

// used to make sure URIs are still valid after simplification
JSONLDParser.suffixTest = new RegExp('^' + N3Lexer._suffix.source + '$');

JSONLDParser.prototype.toN3 = function (jsonld)
{
    var idMap = {};
    var context = _.cloneDeep(jsonld['@context']) || {};
    context['_'] = '_';
    // TODO: what if there is also a base prefix in deeper contexts?
    if (context[N3Parser.BASE])
    {
        context[''] = context[N3Parser.BASE];
        delete context[N3Parser.BASE];
    }
    var n3 = this._toN3(jsonld, context, idMap);

    // remove root graph
    if (('@graph' in jsonld) && !_.startsWith(n3.statement, '{} .'))
        n3.statement = n3.statement.substring(2, n3.statement.length-2);

    var result;
    if (n3.triples.length > 0)
        result = this.tripleListToN3(n3.triples, idMap);
    else
        result = n3.statement;

    // TODO: only supporting prefixes of root graph for now
    for (var key in context)
    {
        if (key === '_')
            continue;
        result = format('PREFIX %s: <%s>\n%s', key, context[key], result);
    }
    return result + ' .';
};

JSONLDParser.prototype._toN3 = function (jsonld, context, idMap)
{
    var subject, n3s, roots = [], key;

    // strings need escaping, tick marks, etc. Will be handled later in the @value block
    if (_.isString(jsonld))
        jsonld = { '@value': jsonld };

    if (Util.isLiteral(jsonld))
        return { statement: jsonld, triples: [] };

    if ('@list' in jsonld)
    {
        n3s = _.map(jsonld['@list'], function (thingy) { return this._toN3(thingy, context, idMap); }.bind(this));
        subject = format('( %s )', _.map(n3s, 'statement').join(' '));
        roots.push.apply(roots, _.flatten(_.filter(_.map(n3s, 'triples'))));
        if (subject === '(  )')
            subject = '()';
    }

    if ('@graph' in jsonld)
    {
        var newIDMap = {};
        _.assign(newIDMap, idMap);
        n3s = _.map(jsonld['@graph'], function (thingy) { return this._toN3(thingy, context, newIDMap); }.bind(this));
        // results with no triples are subject triples
        subject = format('{ %s }', this.tripleListToN3(_.flatten(_.map(n3s,
            function (n3)
            {
                if (n3.triples.length > 0)
                    return n3.triples;
                if (n3.statement in newIDMap)
                    return [];
                return  { subject: n3.statement };
            })),
            newIDMap));
        if (subject === '{  }')
            subject = '{}';
    }

    if ('@value' in jsonld)
    {
        subject = JSON.stringify(jsonld['@value']);
        // won't have triple quote strings since JSON converts newlines to \n
        if (jsonld['@language'])
            subject = format('%s@%s', subject, jsonld['@language']);
        if (jsonld['@type'])
            subject = format('%s^^%s', subject, this._parseID(jsonld['@type'], context));
    }

    // TODO: @forAll, @forSome

    if ('@id' in jsonld)
    {
        var id = this._parseID(jsonld['@id'], context);
        if (subject !== undefined)
            idMap[id] = subject;
        subject = id;
    }

    if ('@context' in jsonld)
    {
        context = _.cloneDeep(context);
        _.assign(context, jsonld['@context']);
    }

    var triples = [];
    for (key in jsonld)
    {
        if (key[0] === '@' && (key !== '@type' || '@value' in jsonld)) // @type has already been handled if there is a @value
            continue;

        var objects = jsonld[key];
        if (!_.isArray(objects))
            objects = [objects];
        // interpret @type values as @ids
        if (key === '@type')
        {
            key = 'a';
            objects = _.map(objects, function (type) { return { '@id': type }});
        }
        else if (key === 'log:implies')
            key = '=>';
        else
            key = this._parseID(key, context);
        objects = _.map(objects, function (thingy) { return this._toN3(thingy, context, idMap); }.bind(this));

        for (var i = 0; i < objects.length; ++i)
        {
            roots.push.apply(roots, objects[i].triples);
            triples.push({subject: subject, predicate: key, object: objects[i].statement });
        }
    }

    // blank nodes []
    if (subject === undefined)
        return { statement: triples.length === 0 ? '[]' : this.tripleListToN3(triples, idMap), triples: roots };
    else
        return { statement: subject, triples: triples.concat(roots) };
};

JSONLDParser.prototype.tripleListToN3 = function (triples, idMap)
{
    if (triples.length === 0)
        return '';

    // convert list to tree
    var tree = {}, s, p, o;
    for (var i = 0; i < triples.length; ++i)
    {
        s = parseID(triples[i].subject);
        if (!(s in tree))
            tree[s] = {};
        if (!('predicate' in triples[i]))
            continue;
        p = parseID(triples[i].predicate);
        o = parseID(triples[i].object);
        if (!(p in tree[s]))
            tree[s][p] = [];
        tree[s][p].push(o);
    }

    var subjects = [];
    for (s in tree)
    {
        var predicates = [];
        for (p in tree[s])
            predicates.push(format('%s %s', p, tree[s][p].join(' , ')));
        if (predicates.length === 0)
            subjects.push(s);
        else if (s === 'undefined') // undefined gets translated to a string by being an object key
            subjects.push(format('[ %s ]', predicates.join(' ; ')));
        else
            subjects.push(format('%s %s', s, predicates.join(' ;\n')));
    }
    return subjects.join(' .\n');

    function parseID(id) { return idMap[id] || id; }
};

JSONLDParser.prototype._parseID = function (id, context)
{
    var prefix, suffix;
    if (id[0] === '?' || Util.isNonStringLiteral(id))
        return id + '';

    var colonIdx = id.indexOf(':');
    if (colonIdx >= 0)
    {
        prefix = id.substring(0, colonIdx);
        suffix = id.substring(colonIdx+1);
        if (prefix === N3Parser.BASE)
            prefix = '';
        if ((context[prefix] || prefix === '_') && suffix.substr(0, 2) !== '//')
            return format('%s:%s', prefix, suffix);
    }
    for (prefix in context)
    {
        var namespace = context[prefix];
        if (_.startsWith(id, namespace))
        {
            suffix = id.substring(namespace.length);
            if (JSONLDParser.suffixTest.test(suffix))
                return format('%s:%s', prefix, suffix);
        }
    }

    return format('<%s>', id);
};

module.exports = JSONLDParser;