#!/usr/bin/env node
var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var minimist = require('minimist');
var level = require('level');

var argv = minimist(process.argv.slice(2));
var HOME = process.env.HOME || process.env.USERDIR;
var datadir = argv.d || path.join(HOME, '.timetrack');

var db = level(path.join(datadir, 'db'), { encoding: 'json' });

if (argv.h) usage(0)
else if (argv._[0] === 'start') {
    var d = argv.d ? new Date(argv.d) : new Date;
    var key = strftime('time!%F %T', d);
    db.put(key, 0);
}
else if (argv._[0] === 'stop') {
    var d = argv.d ? new Date(argv.d) : new Date;
    var s = db.createReadStream({
        gt: 'time!', lt: 'time!~',
        limit: 1, reverse: true
    });
    s.once('data', function (row) {
        db.put(row.key, strftime('%F %T', d));
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
            var elapsed = ((new Date) - started) / 1000;
            var hh = pad(Math.floor(elapsed / 60 / 60), 2);
            var mm = pad(Math.floor(elapsed / 60 % 60), 2);
            var ss = pad(Math.floor(elapsed / 60 / 60 % 60), 2);
            console.log('elapsed time: ' + [ hh, mm, ss ].join(':'));
        }
        else {
            console.log('stopped');
        }
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
    return Array(Math.max(0, s.length - len + 1)).join('0') + s;
}
