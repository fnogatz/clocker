module.exports = Clocker

var path = require('path')

var level = require('level')
var mkdirp = require('mkdirp')
var parseTime = require('parse-messy-time')
var strftime = require('strftime')
var through2 = require('through2')

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
  'end'
]

Clocker.getDataObject = function (row) {
  var obj = {}
  obj.key = toStamp(row.key)
  obj.data = row.value || {}

  obj.start = new Date(row.key.split('!')[1])
  obj.end = (obj.data.end ? new Date(obj.data.end) : 'NOW')

  var milliseconds = (obj.data.end ? obj.end : new Date()) - obj.start
  var seconds = Math.floor(milliseconds / 1000)
  obj.elapsed = seconds

  if (obj.data.end) {
    delete obj.data.end
  }

  return obj
}

Clocker.formatElapsed = function (elapsed) {
  var n = elapsed
  var hh = pad(Math.floor(n / 60 / 60), 2)
  var mm = pad(Math.floor(n / 60 % 60), 2)
  var ss = pad(Math.floor(n % 60), 2)
  return [ hh, mm, ss ].join(':')
}

Clocker.prototype.close = function (cb) {
  this.db.close(cb)
}

Clocker.prototype.start = function (data, date, cb) {
  // Normalize input
  // (1) data argument
  if (typeof data === 'function') {
    cb = data
    date = null
    data = null
  } else if (typeof data === 'string' || data instanceof Date) {
    // missing data argument
    cb = date
    date = data
    data = null
  }
  // (2) date argument
  if (typeof date === 'function') {
    cb = date
    date = null
  } else if (typeof date === 'string') {
    date = parseTime(date)
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

    this.start(entry.data, cb)
  })
}

Clocker.prototype.stop = function (id, data, cb) {
  if (typeof id === 'function') {
    cb = id
    id = undefined
  }
  if (typeof data === 'function') {
    // first argument might be id or data
    cb = data
    if (typeof id === 'object') {
      data = id
      id = undefined
    } else {
      data = undefined
    }
  }
  data = data || {}

  this._get(id, (err, id, row) => {
    if (err) {
      return cb(err)
    }

    try {
      row = addData(data, row)
    } catch (err) {
      return cb(err)
    }

    var date = new Date()
    row.end = strftime('%F %T', date)
    this.db.put(id, row, cb)
  })
}

Clocker.prototype.status = function (id, cb) {
  if (typeof id === 'function') {
    cb = id
    id = undefined
  }

  this._get(id, (err, id, row) => {
    if (err) {
      if (err.message === 'Empty database') {
        return cb(null, 'stopped')
      }

      return cb(err)
    }

    var started = new Date(id.split('!')[1])
    if (!row.end) {
      var elapsed = (new Date()) - started
      var seconds = elapsed / 1000
      return cb(null, 'elapsed time: ' + Clocker.formatElapsed(seconds))
    }

    return cb(null, 'stopped')
  })
}

Clocker.prototype._get = function (id, cb) {
  if (!id) {
    this._getLastRow((err, row) => {
      if (err) {
        return cb(err)
      }

      id = row.key.split('!')[1]
      this._get(id, cb)
    })
    return
  }

  var key = getKey(id)
  this.db.get(key, function (err, row) {
    if (err) {
      return cb(err)
    }

    return cb(null, key, row)
  })
}

Clocker.prototype.get = function (id, cb) {
  if (typeof id === 'function') {
    cb = id
    id = undefined
  }

  this._get(id, function (err, key, row) {
    if (err) {
      return cb(err)
    }

    var data = Clocker.getDataObject({
      key: key,
      value: row
    })
    return cb(null, data)
  })
}

Clocker.prototype.set = function (id, key, value, cb) {
  var update = {}

  if (typeof key === 'function') {
    // missing id, update given as object
    cb = key
    update = id
    id = undefined
  }
  if (typeof value === 'function') {
    cb = value
    if (typeof key === 'object') {
      // missing value because update is given as object
      update = key
    } else {
      // missing optional id argument
      update[id] = key
      id = undefined
    }
  }
  if (typeof key === 'string') {
    update[key] = value
  }

  this._get(id, (err, id, row) => {
    if (err) {
      return cb(err)
    }

    for (var key in update) {
      if (key === 'start' || key === 'begin') {
        // skip here
      } else if (key === 'stop' || key === 'end') {
        if (typeof update[key] === 'string') {
          update[key] = parseTime(update[key])
        }
        row.end = strftime('%F %T', update[key])
      } else {
        row[key] = update[key]
      }
    }

    var startKey = false
    ;['start', 'begin'].forEach(function (key) {
      if (update.hasOwnProperty(key)) {
        startKey = key
      }
    })
    if (startKey) {
      if (typeof update[startKey] === 'string') {
        update[startKey] = parseTime(update[startKey])
      }

      var newId = strftime(Clocker.KEY_FORMAT, update[startKey])
      if (newId !== id) {
        this.db.batch([
          { type: 'del', key: id },
          { type: 'put', key: newId, value: row }
        ], function (err) {
          if (err) {
            return cb(err)
          }
          return cb(null, toStamp(newId))
        })
        return
      }
    }

    this.db.put(id, row, function (err) {
      if (err) {
        return cb(err)
      }
      return cb(null, toStamp(id))
    })
  })
}

Clocker.prototype.remove = function (id, cb) {
  // normalize input
  if (typeof id === 'function') {
    cb = id
    id = undefined
  }
  if (!id) {
    this._getLastRow((err, row) => {
      if (err) {
        return cb(err)
      }

      id = row.key.split('!')[1]
      this.remove(id, cb)
    })
    return
  }

  this.db.del(getKey(id), cb)
}

Clocker.prototype.add = function (start, end, data, cb) {
  var from = strftime('%F %T', getDate(start))

  if (typeof data === 'function') {
    cb = data
    data = {}
  }

  var value = {}
  for (var key in data) {
    value[key] = data[key]
  }
  value.end = getDate(end)

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

Clocker.prototype.dataStream = function (filter) {
  filter = filter || {}
  filter.test = filter.test || function () { return true }

  var s = this.db.createReadStream({
    gt: 'time!' + (filter.gt ? strftime('%F %T', getDate(filter.gt)) : ''),
    lt: 'time!' + (filter.lt ? strftime('%F %T', getDate(filter.lt)) : '~')
  })

  var stream = s.pipe(through2.obj(function (row, _, cb) {
    var entry = Clocker.getDataObject(row)
    cb(null, entry)
  })).pipe(through2.obj(function (entry, _, cb) {
    if (filter.test(entry)) {
      cb(null, entry)
    } else {
      cb()
    }
  }))

  return stream
}

Clocker.prototype.data = function (filter, cb) {
  if (typeof filter === 'function') {
    cb = filter
    filter = {}
  }

  var data = []
  this.dataStream(filter).on('error', function (err) {
    return cb(err)
  }).on('end', function () {
    return cb(null, data)
  })
    .pipe(through2.obj(function (entry, _, finish) {
      data.push(entry)
      finish()
    }))
}

Clocker.prototype._getLastRow = function (cb) {
  var found = false
  this.db.createReadStream({
    gt: 'time!',
    lt: 'time!~',
    limit: 1,
    reverse: true
  }).once('data', function (data) {
    found = true
    return cb(null, data)
  }).on('error', function (err) {
    return cb(err)
  }).on('end', function () {
    if (found === false) {
      return cb(new Error('Empty database'))
    }
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

  if (expr === null || expr === undefined) {
    d = new Date()
  } else if (typeof expr === 'object' && expr instanceof Date) {
    return expr
  } else if (isUnixTimestamp(expr)) {
    d = new Date(expr * 1000)
  } else if (isNaN(timestamp)) {
    d = parseTime(expr)
  } else {
    d = new Date(timestamp)
  }

  return d
}
