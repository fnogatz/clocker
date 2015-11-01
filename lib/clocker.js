module.exports = Clocker

var path = require('path');
var level = require('level');
var through = require('through');
var strftime = require('strftime');

function Clocker (file) {
    this.file = file || Clocker.FILE;
    this.db = level(this.file, { valueEncoding: 'json' });
}

Clocker.HOME = process.env.HOME || process.env.USERPROFILE;
Clocker.FILE = path.join(Clocker.HOME, '.clocker', 'db');

Clocker.prototype.add = function add (row, cb) {
    if (typeof row === 'function') {
        cb = row;
        row = {};
    }
    else {
        row = row || {};
    }
    row.start = row.start || new Date();
    cb = cb || function () {}

    var pkey = strftime('time!%F %T', row.start);
    var tkey = 'time-type!' + row.type + '!' + strftime('%F %T', row.start);

    var value = {
        type: row.type,
        message: row.message
    };
    if (row.end) {
        value.end = row.end;
    }

    this.db.batch([
        { type: 'put', key: pkey, value: value },
        { type: 'put', key: tkey, value: 0 }
    ], function (err) {
        if (err) {
            return cb(err);
        }
        var stamp = toStamp(pkey);
        cb(null, stamp);
    });
    return;
}

Clocker.prototype.data = function data (query, cb) {
    if (typeof query === 'function') {
        cb = query;
        query = {};
    }
    else {
        query = query || {};
    }

    var typeIsRegExp = isRegExp(query.type);
    var rows = [];

    var s = this.db.createReadStream({
        ge: 'time!' + (query.start ? strftime('%F %T', query.start) : ''),
        lt: 'time!' + (query.end ? strftime('%F %T', query.end) : '~')
    });
    var write = function (row) {
        row.stamp = toStamp(row.key);

        if (row.value.archive && !query.archive) return;
        if (!query.type) return rows.push(row);
        if (row.value.type === query.type) return rows.push(row)
        if (typeIsRegExp && testRegExp(query.type, row.value.type)) return rows.push(row);
    };
    s.pipe(through(write, function () {
        cb(null, rows);
    }));
}

Clocker.prototype.start = function start (row, cb) {
    this.add(row, cb);
}

Clocker.prototype.recentKey = function recentKey (cb) {
    this.db.createReadStream({
        gt: 'time!', lt: 'time!~',
        limit: 1, reverse: true
    }).once('data', function (row) {
        cb(row.key, row.value);
    });
}

Clocker.prototype.stop = function stop (key, row, cb) {
    var self = this;

    if (typeof key === 'object') {
        row = key;
        key = undefined;
    }
    else if (typeof key === 'function') {
        cb = key;
        key = undefined;
        row = undefined;
    }
    else if (typeof row === 'function') {
        cb = row;
        row = undefined;
    }
    row = row || {};

    if (key) {
        k = getKey(key);
        this.db.get(k, function (err, value) {
            if (err) {
                return cb(err);
            }
            else onrowstop(k, value);
        });
    }
    else {
        this.recentKey(onrowstop);
    }
    function onrowstop (key, value) {
        var m = row.message;
        if (m) {
            if (value.message) m = value.message + '\n' + m;
            value.message = m;
        }
        value.end = strftime('%F %T', row.date || row.end || new Date());
        self.db.put(key, value, cb);
    }
}

function isRegExp (str) {
    return /^\/.*\/$/.test(str);
}

function testRegExp (re, str) {
    return RegExp(re.slice(1,-1)).test(str);
}

function getKey (x) {
    if (!/^\d+$/.test(x)) return 'time!' + x;
    return strftime('time!%F %T', new Date(x * 1000));
}

function toStamp (s) {
    return Math.floor(new Date(s.split('!')[1]).valueOf() / 1000);
}
