var fs = require('fs');

function toRegExp(s) { return new RegExp(s); }

/*
 * Config options
 */
var config = JSON.parse(fs.readFileSync('./config.json', 'utf8')),

    // string: dir of source files, relative to 'bin'
    srcDir = config.srcDir,

    // string: dir to put built files into, relative to 'bin'
    distDir = config.distDir,

    // array[string]: subdirectories to create in dist
    subdirectories = config.subdirectories,

    // newline character to use in build
    newLine = config.newLine,

    /*
     * array[{
     *    from: string in source file
     *    to: string in built file
     *    setup: array[string]: setup lines in built file, if `from` is found
     *    include: string(regexp) files to include in this translation item
     *    exclude: string(regexp) files to exclude from this translation item
     * }]
     */
    translate = config.translate,

    // name of index file, within dist directory
    indexFile = config.indexFile,

    // array[string(regexp)]: files in source directory to include
    include = config.include.map(toRegExp),

    // array[string(regexp)]: files in source directory to exclude
    exclude = config.exclude.map(toRegExp),

    /*
     * special translation to remove jQuery IIFE: {
     *     start: string(regexp): beginning of IIFE
     *     end: string(regexp): end of IIFE
     * }
     * will de-indent all text inside the IIFE, and error if any code is found outside the IIFE
     * but comments outside the IIFE will be included in the built files.
     */
    unwrap = {
        start: toRegExp(config.unwrap.start),
        end: toRegExp(config.unwrap.end)
    },

    /*
     * array giving the order to process files and how to translate their names
     * [{
     *     match: string(regexp): pattern for this group of files. Within one group
     *         we order lexicographically after removing the .js extension
     *     out: regexp substitution expression to give the output file name
     *     export: optional bool: whether this is the module.exports.
     * }]
     */
    outputOrder = config.outputOrder;


var indexOrder = [];

translate.forEach(function(ti) {
    if(ti.include) ti.include = toRegExp(ti.include);
    if(ti.exclude) ti.exclude = toRegExp(ti.exclude);
});

outputOrder.forEach(function(v) {
    v.match = toRegExp(v.match);
    indexOrder.push(v.match);
});



function unwrapped(lines, fn) {
    // take off the IIFE wrap around everything
    var unwrapStart,
        unwrapEnd;

    for(i = 0; i < lines.length; i++) {
        if(lines[i].match(unwrap.start)) {
            if(unwrapStart !== undefined) {
                throw new Error('multiple unwrap starts found in ' + fn);
            }
            unwrapStart = i;
        }
        if(lines[i].match(unwrap.end)) {
            if(unwrapEnd !== undefined) {
                throw new Error('multiple unwrap ends found in ' + fn);
            }
            unwrapEnd = i;
        }
    }
    if(unwrapEnd <= unwrapStart) {
        throw new Error('unwrap end found before start in ' + fn);
    }
    if(unwrapStart === undefined || unwrapEnd === undefined) {
        throw new Error('wrapping not found in ' + fn);
    }

    var header = lines.slice(0, unwrapStart),
        body = lines.slice(unwrapStart + 1, unwrapEnd).map(function(v, i) {
            if(v && v.substr(0, 4) !== '    ') {
                throw new Error('IIFE body is not all indented in ' + fn + ' body line ' + String(i));
            }
            return v.substr(4);
        }),
        footer = lines.slice(unwrapEnd + 1);
    if(notJustComments(header) || notJustComments(footer)) {
        throw new Error('code found in header or footer in ' + fn);
    }

    return {header: header, body: body, footer: footer};
}

function notJustComments(lines) {
    var linestr = lines
        // take out single-line comments
        .filter(function(line) { return !line.match(/^\s\/\//); })
        .join('');

    // take out /* ... */ comments
    var nonComment = linestr.replace(/\/\*([^\*]|[\*]+[^\/])+\*\//g, '');

    return (nonComment.trim() !== '');
}

function translateBody(body, fnOut) {
    var setup = [];

    for(var i = 0; i < translate.length; i++) {
        var ti = translate[i];

        if(ti.include && !fnOut.match(ti.include)) continue;
        if(ti.exclude && fnOut.match(ti.exclude)) continue;

        if(body.indexOf(ti.to) !== -1) {
            throw new Error('to text "' + ti.to + '" found in file ' + fnOut);
        }

        var bodySplit = body.split(ti.from),
            found = bodySplit.length > 1;

        if(found) {
            body = bodySplit.join(ti.to);
            for(var j = 0; j < ti.setup.length; j++) {
                if(setup.indexOf(ti.setup[j]) === -1) {
                    setup.push(ti.setup[j]);
                }
            }
        }
    }

    if(body.indexOf('$') !== -1) {
        console.log('"$" is still present in ' + fnOut);
    }

    return setup.join(newLine) + newLine + newLine + body;
}

function srcSort(fn1, fn2) {
    var o1 = srcOrder(fn1),
        o2 = srcOrder(fn2),
        n1 = fn1.replace(/[\.]js$/, ''),
        n2 = fn2.replace(/[\.]js$/, '');

    if(o1 < o2) return -1;
    else if(o1 > o2) return 1;
    // within a category: order lexicographically after stripping extension
    else return (n1 < n2) ? -1 : 1;
}

function srcOrder(fn) {
    for(var i = 0; i < indexOrder.length; i++) {
        if(fn.match(indexOrder[i])) return i;
    }
    throw new Error('no sort order found for file ' + fn);
}

function srcInclude(fn) {
    var i,
        match = false;
    for(i = 0; i < include.length; i++) {
        if(fn.match(include[i])) {
            match = true;
            break;
        }
    }
    if(!match) return false;
    for(i = 0; i < exclude.length; i++) {
        if(fn.match(exclude[i])) {
            return false;
        }
    }
    return true;
}

subdirectories.forEach(function(subdir) {
    fs.mkdirSync(distDir + subdir);
});

var srcFiles = fs.readdirSync(srcDir).filter(srcInclude).sort(srcSort);

var headComment = fs.readFileSync('./head-comment.js', 'utf8');

var indexLines = [];

srcFiles.forEach(function(fn) {
    var fstr = fs.readFileSync(srcDir + fn, 'utf8');

    var fnMap = outputOrder[srcOrder(fn)],
        fnOut = fn.replace(fnMap.match, fnMap.out);

    // tabs to spaces
    fstr = fstr.replace(/\t/g, '    ');
    var lines = fstr.split(/\r?\n/);

    // generate the built source file
    var parts = unwrapped(lines, fn),
        header = parts.header.join(newLine),
        body = translateBody(parts.body.join(newLine), fnOut),
        footer = parts.footer.join(newLine),
        outStr = [headComment, header, body, footer].join(newLine);

    // write this file and include it in the index in the right place
    fs.writeFileSync(distDir + fnOut + '.js', outStr);

    if(fnMap.export) {
        indexLines.push("module.exports = require('./" + fnOut + "');");
    }
    else {
        indexLines.push("require('./" + fnOut + "');")
    }
});

fs.writeFileSync(distDir + indexFile, headComment + newLine + indexLines.join(newLine));
