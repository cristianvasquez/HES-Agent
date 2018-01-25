/**
 * Created by joachimvh on 7/12/2015.
 */
function N3Lexer () {}

// TODO: check up what reserved escapes are supposed to do http://www.w3.org/TR/turtle/#sec-escapes
// TODO: 32 bit unicode (use something like http://apps.timwhitlock.info/js/regex# ? or use xregexp with https://gist.github.com/slevithan/2630353 )
N3Lexer._PN_CHARS_BASE = /^[A-Z_a-z\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u02ff\u0370-\u037d\u037f-\u1fff\u200c-\u200d\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]/;
N3Lexer._PN_CHARS_U = new RegExp('^(?:' + N3Lexer._PN_CHARS_BASE.source.substring(1) + '|_)');
N3Lexer._PN_CHARS = new RegExp('^(?:' + N3Lexer._PN_CHARS_U.source.substring(1) + '|' + /[-0-9\u00b7\u0300-\u036f\u203f-\u2040]/.source + ')');
N3Lexer._PLX = /^(?:%[0-9a-fA-F]{2})|(?:\\[-_~.!$&'()*+,;=/?#@%])/;
// using _U instead of _BASE to also match blank nodes
N3Lexer._prefix = new RegExp(
    N3Lexer._PN_CHARS_U.source + '(?:(?:' + N3Lexer._PN_CHARS.source.substring(1) + '|\\.)*' + N3Lexer._PN_CHARS.source.substring(1) + ')?'
);
N3Lexer._suffix = new RegExp(
    '^(?:' + N3Lexer._PN_CHARS_U.source.substring(1) + '|[:0-9]|' + N3Lexer._PLX.source.substring(1) + ')' +
    '(?:(?:' + N3Lexer._PN_CHARS.source.substring(1) + '|[.:]|' + N3Lexer._PLX.source.substring(1) + ')*(?:' + N3Lexer._PN_CHARS.source.substring(1) + '|:|' + N3Lexer._PLX.source.substring(1) + '))?'
);
N3Lexer._prefixIRI = new RegExp(
    '^(?:' + N3Lexer._prefix.source.substring(1) + ')?:' + '(?:' + N3Lexer._suffix.source.substring(1)  + ')?'
);
N3Lexer._variableRegex = new RegExp(
    '^\\?' + N3Lexer._prefix.source.substring(1)
);
N3Lexer._iriRegex = /^<[^>]*>/;
N3Lexer._literalRegex = new RegExp(
    /^(("|')(\2\2)?(?:[^]*?[^\\])??(?:\\\\)*\3\2)/.source +
    '((\\^\\^(?:(?:' + N3Lexer._iriRegex.source.substring(1) + ')|(?:' + N3Lexer._prefixIRI.source.substring(1) + ')))' +
    '|(' + /@[a-z]+(-[a-z0-9]+)*/.source + '))?'
);
N3Lexer._numericalRegex = /^[-+]?(?:(?:(?:(?:[0-9]+\.?[0-9]*)|(?:\.[0-9]+))[eE][-+]?[0-9]+)|(?:[0-9]*(\.[0-9]+))|(?:[0-9]+))/;

N3Lexer.prototype.parse = function (input)
{
    var state = new N3LexerState(input);
    return this._parse(state);
};

// TODO: comments and special data exceptions (e.g. \u)
N3Lexer.prototype._parse = function (state)
{
    var statements = [];
    while (!state.eof())
    {
        var c = state.firstChar();
        statements.push(this._statement(state));
        // PREFIX and BASE
        if (c !== 'P' && c !== 'p' && c !== 'B' && c !== 'b') // TODO: should we check for newlines?
            state.move('.');
    }
    return { type: 'Document', val: statements };
};

N3Lexer.prototype._statement = function (state)
{
    var c = state.firstChar();
    var result;
    if (c === '@' || c ==='P' || c === 'p' || c === 'B' || c === 'b')
    {
        var first = state.firstWord();
        if (first === '@forAll')
        {
            state.move(first, true);
            result = { type: 'Universal', val: this._objects(state) };
        }
        else if (first === '@forSome')
        {
            state.move(first, true);
            result = { type: 'Existential', val: this._objects(state) };
        }
        else if (first === '@prefix' || first.toUpperCase() === 'PREFIX') // PREFIX is a case insensitive form
        {
            state.move(first, true);
            var prefix;
            if (state.firstChar() === ':')
                prefix = '';
            else
                prefix = state.extract(N3Lexer._prefix);
            state.move(':');
            var iri = state.extract(N3Lexer._iriRegex);
            result = { type: 'Prefix', val: [prefix, iri] };
        }
        else if (first === '@base' || first.toUpperCase() === 'BASE') throw new Error('@base is not supported yet.'); // TODO
        else if (first === '@keywords') throw new Error('@keywords is not supported yet.'); // TODO
        else throw new Error('Unsupported keyword ' + first);
    }
    else
        result = { type: 'TripleData', val: [ this._subject(state), this._propertylist(state) ] };
    return result;
};

N3Lexer.prototype._subject = function (state)
{
    return this._expression(state);
};

N3Lexer._delimiterRegex = /[.\]})]/;
N3Lexer.prototype._propertylist = function (state)
{
    // propertylist can be empty!
    var c = state.firstChar();
    if (N3Lexer._delimiterRegex.exec(c))
        return [];
    var propertyLists = [{ type: 'PredicateObject', val: [ this._predicate(state), this._objects(state) ] }];
    while (state.firstChar() === ';')
    {
        // you can have multiple semicolons...
        while (state.firstChar() === ';')
            state.move(';', true);
        // propertylist can end on a semicolon...
        if (N3Lexer._delimiterRegex.exec(state.firstChar()))
            break;
        propertyLists.push({ type: 'PredicateObject', val: [ this._predicate(state), this._objects(state) ] });
    }
    return propertyLists;
};

N3Lexer.prototype._predicate = function (state)
{
    var c = state.firstChar();
    var c2 = state.firstChars(2);

    var result;
    // TODO: space is not enough for check 2nd character
    if (c2 === '@a' || c2 === 'a ')
    {
        var first = state.firstWord();
        result = { type: 'SymbolicIRI', val: first};
        state.move(first, true);
    }
    else if (c === '=' && c2 == '=>' || c2 === '<=')
    {
        result = { type: 'SymbolicIRI', val: c2};
        state.move(c2, true);
    }
    else if (c === '=')
    {
        result = { type: 'SymbolicIRI', val: c2};
        state.move(c, true);
    }
    else if (c2 === '@h') throw new Error('@has is not supported yet.'); // TODO
    else if (c2 === '@i') throw new Error('@is is not supported yet.'); // TODO
    else result = this._expression(state);

    return result;
};

N3Lexer.prototype._objects = function (state)
{
    var objects = [this._expression(state)];
    while (state.firstChar() === ',')
    {
        state.move(',', true);
        objects.push(this._expression(state));
    }
    return objects;
};

N3Lexer.prototype._expression = function (state)
{
    var c = state.firstChar();
    var result, match;
    if (c === '{')
    {
        state.move(c, true);
        var statements = [];
        while (state.firstChar() !== '}')
        {
            statements.push(this._statement(state));
            if (state.firstChar() === '}') // no final '.'
                break;
            state.move('.');
        }
        state.move('}');
        result = { type: 'Formula', val: statements };
    }
    else if (c === '[')
    {
        state.move(c, true);
        var propertyList = this._propertylist(state);
        state.move(']');
        result = { type: 'BlankTripleData', val: propertyList};
    }
    else if (c === '(')
    {
        state.move(c, true);
        var expressions = [];
        while (state.firstChar() !== ')')
            expressions.push(this._expression(state));
        state.move(')');
        result = { type: 'List', val: expressions };
    }
    else if (c === '?')
    {
        match = state.extract(N3Lexer._variableRegex);
        result = { type: 'Variable', val: match };
    }
    else if (c === '"' || c === "'")
    {
        match = N3Lexer._literalRegex.exec(state.input);
        state.move(match[0], true);

        var str = match[1];
        var type = match[5];
        var lang = match[6];

        type = type && this._expression(new N3LexerState(type.substring(2))); // ExplicitIRI or PrefixedIRI
        lang = lang && lang.substring(1);

        result = { type: 'RDFLiteral', val: [str, type, lang] };
    }
    else if (c >= '0' && c <= '9' || c === '-' || c === '+' || c === '.')
    {
        match = state.extract(N3Lexer._numericalRegex);
        result = { type: 'NumericLiteral', val: match };
    }
    else if (c === '<')
    {
        var idx = state.input.indexOf('>');
        if (idx < 0)
            throw new Error('URI closing bracket not found');
        var iri = state.input.substring(0, idx+1);
        state.moveLength(idx+1);
        result = { type: 'ExplicitIRI', val: iri };
    }
    else
    {
        // could be a prefix starting with 'true' ...
        var first = state.firstWord();
        if (first === 'true' || first === 'false' || first === '@true' || first === '@false')
        {
            result = { type: 'BooleanLiteral', val: first };
            state.move(first, true);
        }
        else
        {
            match = state.extract(N3Lexer._prefixIRI);
            result = { type: 'PrefixedIRI', val: match };
        }
    }

    c = state.firstChar();
    if (c === '!') throw new Error('! is not supported yet.'); // TODO
    else if (c === '^') throw new Error('^ is not supported yet.'); // TODO

    return result;
};

function N3LexerState (input){ this.input = input; this.trimLeft(); }

//N3Lexer._trimRegex = /^(?:\s*(?:#.*))*\s*/;
N3Lexer._wordRegex = /\s+|([;.,{}[\]()!^])|(<?=>?)/;
//N3LexerState.prototype.trimLeft   = function ()      { this.input = this.input.replace(N3Lexer._trimRegex, ''); };
N3LexerState.prototype.trimLeft   = function ()
{
    this.input = this.input.trimLeft();
    if (this.input[0] === '#')
    {
        var idx = this.input.indexOf('\n');
        if (idx < 0)
            this.input = '';
        else
            this.input = this.input.substring(idx);
        this.trimLeft();
    }
};
N3LexerState.prototype.firstChar  = function ()      { return this.input[0]; };
N3LexerState.prototype.firstChars = function (count) { if (!count || count === 1) return this.input[0]; return this.input.substr(0, count); };
N3LexerState.prototype.firstWord  = function ()      { return this.input.split(N3Lexer._wordRegex, 1)[0]; };
N3LexerState.prototype.eof        = function ()      { return this.input.length === 0; };
N3LexerState.prototype.startsWith = function (match) { return this.input.startsWith(match); };

N3LexerState.prototype.move = function (part, unsafe)
{
    if (!unsafe && !this.input.startsWith(part))
        throw new Error("Unexpected input " + part);
    this.moveLength(part.length);
};

N3LexerState.prototype.moveLength = function (length)
{
    this.input = this.input.substring(length);
    this.trimLeft();
};

N3LexerState.prototype.extract = function (regex)
{
    var match = regex.exec(this.input);
    if (!match || regex.lastIndex !== 0)
    {
        var lines = this.input.split('\n');
        throw new Error("Input didn't match the regex." + (lines.length ? (' On line \n' + lines[0]) : ''));
    }
    this.move(match[0], true);
    return match[0];
};

module.exports = N3Lexer;