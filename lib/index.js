const toStamp = require('./util').toStamp

const { formatElapsed, getKey } = require('./util')

module.exports = Clocker

const path = require('path')

const { Transform } = require('readable-stream')
const { Level } = require('level')
const { EntryStream } = require('level-read-stream')
const mkdirp = require('mkdirp')
const parseTime = require('parse-messy-time')
const strftime = require('strftime')

const util = require('./util')
const getDate = util.getDate

function Clocker (options) {
  this.dir = options.dir

  // Create data directory if not existing
  if (!this.dir) {
    const HOME = process.env.HOME || process.env.USERPROFILE
    this.dir = path.join(HOME, '.clocker')
  }
  mkdirp.sync(this.dir)

  this.db = new Level(path.join(this.dir, 'db'), { valueEncoding: 'json' })
}

Clocker.RESERVED_DATA_ENTRIES = [
  'start',
  'end'
]

Clocker.getDataObject = function (row) {
  const obj = {}
  obj.key = toStamp(row.key)
  obj.data = row.value || {}

  obj.start = new Date(row.key.split('!')[1])
  obj.end = (obj.data.end ? new Date(obj.data.end) : 'NOW')

  const milliseconds = (obj.data.end ? obj.end : new Date()) - obj.start
  const seconds = Math.floor(milliseconds / 1000)
  obj.elapsed = seconds

  if (obj.data.end) {
    delete obj.data.end
  }

  return obj
}

Clocker.formatElapsed = formatElapsed

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

  const type = data.type
  const pkey = getKey(date)
  const tkey = 'time-type!' + type + '!' + strftime('%F %T', date)
  let value
  try {
    value = addData({ type }, data)
  } catch (err) {
    return cb(err)
  }
  this.db.batch([
    { type: 'put', key: pkey, value },
    { type: 'put', key: tkey, value: 0 }
  ], function (err) {
    if (err) {
      return cb(err)
    }

    const stamp = toStamp(pkey)
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

Clocker.prototype.move = function (id, date, cb) {
  if (typeof date === 'function') {
    cb = date
    date = id
    id = undefined
  }

  this.get(id, (err, entry) => {
    if (err) {
      return cb(err)
    }

    if (entry.end === 'NOW') {
      return cb(new Error(`No end set for entry with id ${entry.key}. Use
\tclocker set start ${entry.key} ${date}
instead.`))
    }

    let start
    try {
      start = getDate(date)
    } catch (err) {
      return cb(err)
    }

    const update = {
      start,
      end: new Date(start.getTime() + entry.elapsed * 1000)
    }
    this.set(id, update, (err, newStamp) => {
      if (err) {
        return cb(err)
      }

      cb(null, newStamp)
    })
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
      row = addData(row, data)
    } catch (err) {
      return cb(err)
    }

    const date = new Date()
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

    const started = new Date(id.split('!')[1])
    if (!row.end) {
      const elapsed = (new Date()) - started
      const seconds = elapsed / 1000
      return cb(null, 'elapsed time: ' + formatElapsed(seconds))
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

  const key = getKey(id)
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

    const data = Clocker.getDataObject({
      key,
      value: row
    })
    return cb(null, data)
  })
}

Clocker.prototype.set = function (id, key, value, cb) {
  let update = {}

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

    for (const key in update) {
      if (key === 'start' || key === 'begin') {
        // skip here
      } else if (key === 'stop' || key === 'end') {
        if (typeof update[key] === 'string') {
          update[key] = parseTime(update[key])
        }
        row.end = strftime('%F %T', update[key])
      } else if (update[key] === undefined && key in row) {
        // remove key
        delete row[key]
      } else {
        row[key] = update[key]
      }
    }

    let startKey = false
    ;['start', 'begin'].forEach(function (key) {
      if (key in update) {
        startKey = key
      }
    })
    if (startKey) {
      if (typeof update[startKey] === 'string') {
        update[startKey] = parseTime(update[startKey])
      }

      const newId = getKey(update[startKey])
      if (newId !== id) {
        this.db.get(newId, (_err, old) => {
          if (old) {
            return cb(new Error(`There is already another entry with stamp ${toStamp(newId)}. Please move, update, or delete it first.`))
          }

          this.db.batch([
            { type: 'del', key: id },
            { type: 'put', key: newId, value: row }
          ], function (err) {
            if (err) {
              return cb(err)
            }
            return cb(null, toStamp(newId))
          })
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
  if (typeof data === 'function') {
    cb = data
    data = {}
  }

  const value = {}
  for (const key in data) {
    value[key] = data[key]
  }

  let startDate
  try {
    startDate = getDate(start)
    value.end = getDate(end)
  } catch (err) {
    return cb(err)
  }

  if (value.end < startDate) {
    return cb(new Error(`Start date ${start} is greater than end date ${end}.`))
  }

  const from = strftime('%F %T', startDate)
  const type = value.type
  const pkey = 'time!' + from
  const tkey = 'time-type!' + type + '!' + from

  this.db.get(pkey, (_err, old) => {
    if (old) {
      return cb(new Error(`There is already another entry with stamp ${toStamp(pkey)}. Please move, update, or delete it first.`))
    }

    this.db.batch([
      { type: 'put', key: pkey, value },
      { type: 'put', key: tkey, value: 0 }
    ], function (err) {
      if (err) {
        return cb(err)
      }

      const stamp = toStamp(pkey)
      return cb(null, stamp)
    })
  })
}

Clocker.prototype.dataStream = function (filter) {
  filter = filter || {}
  filter.test = filter.test || function () { return true }

  const gt = filter.gt ? strftime('%F %T', getDate(filter.gt)) : ''
  const lt = filter.lt ? strftime('%F %T', getDate(filter.lt)) : '~'
  const s = new EntryStream(this.db, {
    gt: 'time!' + gt,
    lt: 'time!' + lt
  })

  const transformer = new Transform({
    readableObjectMode: true,
    writableObjectMode: true,
    transform (row, encoding, cb) {
      const entry = Clocker.getDataObject(row)
      if (filter.test(entry)) {
        cb(null, entry)
      } else {
        cb()
      }
    }
  })
  const stream = s.pipe(transformer)
  return stream
}

Clocker.prototype.data = function (filter, cb) {
  if (typeof filter === 'function') {
    cb = filter
    filter = {}
  }

  const data = []
  this.dataStream(filter).on('error', function (err) {
    return cb(err)
  }).on('end', function () {
    return cb(null, data)
  }).on('data', function (entry) {
    data.push(entry)
  })
}

Clocker.prototype.aggregate = function (by, filter, cb) {
  if (typeof filter === 'function') {
    cb = filter
    filter = {}
  }

  const data = {}
  this.dataStream(filter).on('error', function (err) {
    return cb(err)
  }).on('end', function () {
    return cb(null, data)
  }).on('data', function (entry) {
    // entry might correspond to different by's

    const byValues = getBys(entry, by)
    byValues.forEach(function (byValue) {
      if (!(byValue[0] in data)) {
        data[byValue[0]] = 0
      }
      data[byValue[0]] += byValue[1]
    })
  })
}

Clocker.prototype._getLastRow = function (cb) {
  let found = false
  new EntryStream(this.db, {
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

function getBys (data, _by) {
  const day = {
    get: (e) => {
      return new Date(e.getTime() - (e.getTimezoneOffset() * 60000)).toISOString().split('T')[0]
    },
    next: (e) => new Date((new Date(curr.getFullYear(), curr.getMonth(), curr.getDate(), 23, 59, 59)).getTime() + 1000),
    part: (curr) => {
      curr.toJSON().slice(0, 10)
    }
  }

  // 'day'
  const byer = day

  const entries = []

  let elapsed = data.elapsed
  let curr = data.start
  let currElapsed
  do {
    currElapsed = Math.min((byer.next(curr) - curr.getTime()) / 1000, elapsed)
    entries.push([byer.get(curr), currElapsed])
    curr = byer.next(curr)
    elapsed -= currElapsed
  } while (elapsed > 0)

  return entries
}

function addData (old, update) {
  for (const key in update) {
    if (Clocker.RESERVED_DATA_ENTRIES.indexOf(key) >= 0) {
      throw new Error(`Reserved data key specified: ${key}`)
    }
    old[key] = update[key]
  }

  return old
}
