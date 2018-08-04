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
  date = date || new Date()
  data = data || {}
  cb = cb || function () {}

  if (!type) {
    throw new Error('No type specified')
  }

  var pkey = strftime(Clocker.KEY_FORMAT, date)
  var tkey = 'time-type!' + type + '!' + strftime('%F %T', date)
  var value = addData({ type: type }, data)
  this.db.batch([
    { type: 'put', key: pkey, value: value },
    { type: 'put', key: tkey, value: 0 }
  ], cb)
}

function addData (old, update) {
  for (var key in update) {
    if (Clocker.RESERVED_DATA_ENTRIES.indexOf(key) >= 0) {
      throw new error('Reserved data key specified: ' + key)
    }
    old[key] = update[key]
  }

  return old
}
