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
            console.log('elapsed time: ' + fmt(elapsed));
        }
        else {
            console.log('stopped');
        }
    });
}
else if (argv._[0] === 'list') {
    var s = db.createReadStream({ gt: 'time!', lt: 'time!~', reverse: true });
    s.once('data', function (row) {
        var start = row.key.split('!')[1];
        var elapsed = (
            (row.value ? new Date(row.value) : new Date) - new Date(start)
        ) / 1000;
        
        var end = row.value ? row.value : 'NOW';
        console.log(start + ' - ' + end + '  (' + fmt(elapsed) + ')');
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
    var hh = pad(Math.floor(elapsed / 60 / 60), 2);
    var mm = pad(Math.floor(elapsed / 60 % 60), 2);
    var ss = pad(Math.floor(elapsed % 60), 2);
    return [ hh, mm, ss ].join(':');
}
