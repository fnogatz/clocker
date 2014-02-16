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
    var tkey = 'time-type!' + type + '!' + strftime('%F %T', d);
    db.batch([
        { type: 'put', key: pkey, value: { type: type } },
        { type: 'put', key: tkey, value: 0 }
    ], error);
}
else if (argv._[0] === 'stop') {
    var d = argv.d ? new Date(argv.d) : new Date;
    var s = db.createReadStream({
        gt: 'time!', lt: 'time!~',
        limit: 1, reverse: true
    });
    s.once('data', function (row) {
        row.value.end = strftime('%F %T', d);
        db.put(row.key, row.value, error);
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
        
        var start = new Date(row.key.split('!')[1]);
        var end = row.value.end && new Date(row.value.end);
        var elapsed = (end ? end : new Date) - start;
        
        console.log(
            '%s  %s  [ %s - %s ]  (%s)%s',
            toKey(start),
            strftime('%F', start),
            strftime('%T', start),
            end ? strftime('%T', end) : 'NOW',
            fmt(elapsed),
            (row.value.type ? '  [' + row.value.type + ']' : '')
        );
    });
}
else if (argv._[0] === 'get') {
    var key = getKey(argv._[1]);
    db.get(key, function (err, row) {
        if (err) return error(err);
        console.log(row);
    });
}
else if (argv._[0] === 'rm') {
    var key = getKey(argv._[1]);
    db.del(key, error);
}
else if (argv._[0] === 'adjust') {
    if (argv._.length < 4) {
        return error('clocker adjust STAMP {start|end} STAMP');
    }
    var key = getKey(argv._[1]);
    var k = argv._[2];
    if (k === 'end') {
        db.get(key, function (err, row) {
            if (err) return error(err);
            var value = argv._.slice(3).join(' ');
            
            var d = new Date(value);
            if (isNaN(d.valueOf())) {
                if (!row[k] || isNaN(row[k])) {
                    row[k] = key.split('!')[1];
                }
                d = new Date(row[k].split(' ')[0] + ' ' + value);
            }
            value = strftime('%F %T', d);
            row[k] = value;
            db.put(key, row, error);
        });
    }
    else {
        console.log('todo');
    }
}
else if (argv._[0] === 'move') {
    if (argv._.length < 2) {
        return error('clocker move STAMP type');
    }
    var key = getKey(argv._[1]);
    var target = argv._[2];
    db.get(key, function (err, row) {
        if (err) return error(err);
        var prevType = row.type;
        row.type = target;
        db.batch([ 
            { type: 'del', key: prevType },
            { type: 'put', key: key, value: row }
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

function toKey (s) {
    return Math.floor(new Date(s).valueOf() / 1000);
}

function getKey (x) {
    return strftime('time!%F %T', new Date(x * 1000));
}
