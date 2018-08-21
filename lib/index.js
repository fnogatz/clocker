module.exports = Clocker

var path = require('path')

var level = require('level')
var mkdirp = require('mkdirp')
var parseTime = require('parse-messy-time')
var strftime = require('strftime')

function Clocker (options) {
  this.dir = options.dir

  // Create data directory if not existing
  if (!this.dir) {
    var HOME = process.env.HOME || process.env.USERPROFILE
    this.dir = path.join(HOME, '.clocker')
  }
  mkdirp.sync(this.dir)

  this.db = level(path.join(this.dir, 'db'), { valueEncoding: 'json' })
}

Clocker.KEY_FORMAT = 'time!%F %T'

Clocker.RESERVED_DATA_ENTRIES = [
  'start',
  'end',
  'message'
]

Clocker.prototype.close = function (cb) {
  this.db.close(cb)
}

Clocker.prototype.start = function (data, date, cb) {
  // Normalize input
  if (typeof data === 'function') {
    cb = data
    date = null
    data = null
  }
  if (typeof date === 'function') {
    cb = date
    if (data instanceof Date) {
      date = data
      data = null
    } else {
      date = null
    }
  }
  date = date || new Date()
  data = data || {}
  cb = cb || function () {}

  var type = data.type
  var pkey = strftime(Clocker.KEY_FORMAT, date)
  var tkey = 'time-type!' + type + '!' + strftime('%F %T', date)
  try {
    var value = addData({ type: type }, data)
  } catch (err) {
    return cb(err)
  }
  this.db.batch([
    { type: 'put', key: pkey, value: value },
    { type: 'put', key: tkey, value: 0 }
  ], function (err) {
    if (err) {
      return cb(err)
    }

    var stamp = toStamp(pkey)
    return cb(null, stamp)
  })
}

Clocker.prototype.restart = function (id, cb) {
  if (typeof id === 'function') {
    cb = id
    id = undefined
  }

  this.get(id, (err, entry) => {
    if (err) {
      return cb(err)
    }

    this.start(entry, cb)
  })
}

Clocker.prototype.stop = function (cb) {
  // Stop the latest entry
  this.db.createReadStream({
    gt: 'time!',
    lt: 'time!~',
    limit: 1,
    reverse: true
  }).once('data', (row) => {
    var date = new Date()
    row.value.end = strftime('%F %T', date)
    this.db.put(row.key, row.value, cb)
  })
}

Clocker.prototype.status = function (cb) {
  var status = 'stopped'

  var s = this.db.createReadStream({
    gt: 'time!',
    lt: 'time!~',
    limit: 1,
    reverse: true
  })
  s.once('data', function (row) {
    var started = new Date(row.key.split('!')[1])
    if (!row.value.end) {
      var elapsed = (new Date()) - started
      status = 'elapsed time: ' + fmt(elapsed)
    }
  })
  s.once('end', function () {
    cb(null, status)
  })
}

Clocker.prototype.get = function (id, cb) {
  // normalize input
  if (typeof id === 'function') {
    cb = id
    id = undefined
  }
  if (!id) {
    this._getLastRow((row) => {
      id = row.key.split('!')[1]
      this.get(id, cb)
    })
    return
  }

  this.db.get(getKey(id), cb)
}

Clocker.prototype.remove = function (id, cb) {
  // normalize input
  if (typeof id === 'function') {
    cb = id
    id = undefined
  }
  if (!id) {
    this._getLastRow((row) => {
      id = row.key.split('!')[1]
      this.remove(id, cb)
    })
    return
  }

  this.db.del(getKey(id), cb)
}

Clocker.prototype.add = function (start, end, data, cb) {
  var from = strftime('%F %T', getDate(start))
  var to = strftime('%F %T', getDate(end))

  if (typeof data === 'function') {
    cb = data
    data = {}
  }

  var value = addData({ end: to }, data)
  var type = value.type
  var pkey = 'time!' + from
  var tkey = 'time-type!' + type + '!' + from

  this.db.batch([
    { type: 'put', key: pkey, value: value },
    { type: 'put', key: tkey, value: 0 }
  ], function (err) {
    if (err) {
      return cb(err)
    }

    var stamp = toStamp(pkey)
    return cb(null, stamp)
  })
}

Clocker.prototype._getLastRow = function (cb) {
  this.db.createReadStream({
    gt: 'time!',
    lt: 'time!~',
    limit: 1,
    reverse: true
  }).once('data', cb)
}

function addData (old, update) {
  for (var key in update) {
    if (Clocker.RESERVED_DATA_ENTRIES.indexOf(key) >= 0) {
      throw new Error('Reserved data key specified: ' + key)
    }
    old[key] = update[key]
  }

  return old
}

function fmt (elapsed) {
  var n = elapsed / 1000
  var hh = pad(Math.floor(n / 60 / 60), 2)
  var mm = pad(Math.floor(n / 60 % 60), 2)
  var ss = pad(Math.floor(n % 60), 2)
  return [ hh, mm, ss ].join(':')
}

function pad (s, len) {
  return Array(Math.max(0, len - String(s).length + 1)).join('0') + s
}

function getKey (x) {
  if (x === 'NaN') {
    return strftime(Clocker.KEY_FORMAT, new Date(NaN))
  }

  if (typeof x === 'object' && x instanceof Date) {
    return strftime(Clocker.KEY_FORMAT, x)
  }

  if (!/^\d+$/.test(x)) {
    return 'time!' + x
  }
  return strftime(Clocker.KEY_FORMAT, new Date(x * 1000))
}

function toStamp (s) {
  return Math.floor(new Date(s.split('!')[1]).valueOf() / 1000)
}

function isUnixTimestamp (expr) {
  return /^1[0-9]{9}$/.test(expr)
}

function getDate (expr) {
  var d
  var timestamp = Date.parse(expr)

  if (isUnixTimestamp(expr)) {
    d = new Date(expr * 1000)
  } else if (isNaN(timestamp)) {
    d = parseTime(expr)
  } else {
    d = new Date(timestamp)
  }

  return d
}
