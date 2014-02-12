#!/usr/bin/env node
var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var minimist = require('minimist');
var level = require('level');
var strftime = require('strftime');

var argv = minimist(process.argv.slice(2));
var HOME = process.env.HOME || process.env.USERDIR;
var datadir = argv.d || path.join(HOME, '.timetrack');
mkdirp.sync(datadir);

var db = level(path.join(datadir, 'db'), { encoding: 'json' });

if (argv.h) usage(0)
else if (argv._[0] === 'start') {
    var d = argv.d ? new Date(argv.d) : new Date;
    var type = argv.type || argv.t || 'undefined';
    var pkey = strftime('time!%F %T', d);
    var tkey = 'time-type!' + type + strftime('!%F %T', d);
    db.batch([
        { key: pkey, value: { type: type } },
        { key: tkey, value: 0 }
    ], error);
    db.put(key, { type: argv.type || argv.t });
}
else if (argv._[0] === 'stop') {
    var d = argv.d ? new Date(argv.d) : new Date;
    var s = db.createReadStream({
        gt: 'time!', lt: 'time!~',
        limit: 1, reverse: true
    });
    s.once('data', function (row) {
        row.value.end = strftime('%F %T', d);
        db.put(row.key, row, error);
    });
}
else if (argv._[0] === 'status') {
    var s = db.createReadStream({
        gt: 'time!', lt: 'time!~',
        limit: 1, reverse: true
    });
    s.once('data', function (row) {
        var started = new Date(row.key.split('!')[1]);
        if (!row.value) {
            var elapsed = (new Date) - started;
            console.log('elapsed time: ' + fmt(elapsed));
        }
        else {
            console.log('stopped');
        }
    });
}
else if (argv._[0] === 'list') {
    var s = db.createReadStream({ gt: 'time!', lt: 'time!~' });
    s.on('error', error);
    s.on('data', function (row) {
        if (argv.raw) return console.log(JSON.stringify(row));
        
        var start = row.key.split('!')[1];
        var end = row.value.end;
        var elapsed = (end ? new Date(end) : new Date) - new Date(start);
        
        console.log(
            '%s  %s - %s  (%s)%s',
            new Date(start).valueOf(), start, end || 'NOW', fmt(elapsed),
            (row.value.type ? '  [' + row.value.type + ']' : '')
        );
    });
}
else if (argv._[0] === 'set') {
    db.put(argv._[1], JSON.parse(argv._[2]), error);
}
else if (argv._[0] === 'put') {
    db.put(argv._[1], JSON.parse(argv._[2]), error);
}
else if (argv._[0] === 'get') {
    db.get(argv._[1], function (err, row) {
        if (err) {
            console.error(String(err));
            process.exit(1);
        }
        else console.log(row);
    });
}
else if (argv._[0] === 'move') {
    db.get(argv._[1], function (err, row) {
        if (err) error(err);
        else db.batch([ 
            { type: 'del', key: argv._[1] },
            { type: 'put', key: argv._[2], value: row }
        ], error);
    });
}
else usage(1)

function usage (code) {
    var rs = fs.createReadStream(__dirname + '/usage.txt');
    rs.pipe(process.stdout);
    rs.on('close', function () {
        if (code) process.exit(code);
    });
}

function pad (s, len) {
    return Array(Math.max(0, len - String(s).length + 1)).join('0') + s;
}

function fmt (elapsed) {
    var n = elapsed / 1000;
    var hh = pad(Math.floor(n / 60 / 60), 2);
    var mm = pad(Math.floor(n / 60 % 60), 2);
    var ss = pad(Math.floor(n % 60), 2);
    return [ hh, mm, ss ].join(':');
}

function error (err) {
    if (!err) return;
    console.error(String(err));
    process.exit(1);
}
