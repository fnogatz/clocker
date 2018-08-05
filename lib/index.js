module.exports = Clocker

var path = require('path')

var level = require('level')
var mkdirp = require('mkdirp')
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
  'type',
  'message'
]

Clocker.prototype.start = function (type, date, data, cb) {
  // Normalize input
  if (typeof date === 'function') {
    cb = date
    date = null
    data = null
  }
  if (typeof data === 'function') {
    cb = data
    if (date instanceof Date) {
      data = null
    } else {
      data = date
      date = null
    }
  }
  date = date || new Date()
  data = data || {}
  cb = cb || function () {}

  if (!type) {
    return cb(new Error('No type specified'))
  }

  var pkey = strftime(Clocker.KEY_FORMAT, date)
  var tkey = 'time-type!' + type + '!' + strftime('%F %T', date)
  try {
    var value = addData({ type: type }, data)
  } catch (e) {
    return cb(e)
  }
  this.db.batch([
    { type: 'put', key: pkey, value: value },
    { type: 'put', key: tkey, value: 0 }
  ], cb)
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
