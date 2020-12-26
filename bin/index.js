#!/usr/bin/env node

const path = require('path')
const os = require('os')
const fs = require('fs')
const program = require('commander')
const strftime = require('strftime')
const editor = require('editor')
const stringify = require('json-stable-stringify')
const tmpdir = os.tmpdir()

const Clocker = require('../lib/index')
const util = require('../lib/util')
const getDate = util.getDate

process.on('uncaughtException', err => {
  console.log(`error: ${err.message}`)
  process.exit(1)
})

const HOME = process.env.HOME || process.env.USERPROFILE
const defaultDataDir = path.join(HOME, '.clocker')

const argvs = splitArgvs(process.argv)

program
  .name('clocker')
  .version(require('../package.json').version)
  .description('track project hours')
  .option('-d, --datadir <path>', 'directory for storage', defaultDataDir)

// Adjust help output for set command
//   as it has two optional arguments,
//   which cannot be handled by commander
const outputHelp = program.outputHelp.bind(program)
program.outputHelp = function (cb) {
  cb = cb || function (passthru) { return passthru }
  const newCb = function (text) {
    return cb(text).replace('set [options] [stamp] <key> [value]', 'set [options] [stamp] <key> <value>')
  }
  outputHelp(newCb)
}

let datadir
program.on('option:datadir', function (value) {
  datadir = value
})

program
  .command('start')
  .usage('[options] [-- <data>]')
  .description('start the clock')
  .option('-t, --type <value>')
  .option('-m, --message <value>')
  .action(start)

program
  .command('stop [stamp]')
  .description('stop the clock')
  .option('-t, --type <value>', 'use latest of type instead of stamp')
  .option('-m, --message <value>')
  .action(stop)

program
  .command('restart [stamp]')
  .description('restart the clock')
  .action(restart)

program
  .command('status [stamp]')
  .description('show the elapsed time')
  .action(status)

program
  .command('data')
  .description('generate invoicer-compatible json output')
  .option('--filter <key=value>', 'filter by key, value as string or /regex/', collect, [])
  .option('-t, --type <value>', 'short for --filter "type=<value>"')
  .option('--gt <date>', 'show dates from gt on')
  .option('--lt <date>', 'show dates upto')
  .option('--day [value]', 'show given day (default: today)')
  .option('--week [value]', 'show given week (default: current week)')
  .option('--month [value]', 'show given month (default: current month)')
  .option('--year [value]', 'show given year (default: current year)')
  .option('-r, --rate <value>', 'add rate property', parseFloat)
  .option('-a, --all', 'include archived dates')
  .action(aggregateJson)

program
  .command('list')
  .alias('ls')
  .description('show data entries')
  .option('-v, --verbose', 'also show clocked messages')
  .option('--filter <key=value>', 'filter by key, value as string or /regex/', collect, [])
  .option('-t, --type <value>', 'short for --filter "type=<value>"')
  .option('--gt <date>', 'show dates from gt on')
  .option('--lt <date>', 'show dates upto')
  .option('--day [value]', 'show given day (default: today)')
  .option('--week [value]', 'show given week (default: current week)')
  .option('--month [value]', 'show given month (default: current month)')
  .option('--year [value]', 'show given year (default: current year)')
  .option('-a, --all', 'include archived dates')
  .option('-r, --report', 'show report of all logged data entries')
  .action(list)

program
  .command('report')
  .description('show all logged hours of a specific day')
  .option('-v, --verbose', 'also show clocked messages')
  .option('--reportDay <value>', 'day to use')
  .option('-a, --all', 'include archived dates')
  .action(report)

program
  .command('csv')
  .description('generate CSV output')
  .option('--filter <key=value>', 'filter by key, value as string or /regex/', collect, [])
  .option('-t, --type <value>', 'short for --filter "type=<value>"')
  .option('--gt <date>', 'show dates from gt on')
  .option('--lt <date>', 'show dates upto')
  .option('--day [value]', 'show given day (default: today)')
  .option('--week [value]', 'show given week (default: current week)')
  .option('--month [value]', 'show given month (default: current month)')
  .option('--year [value]', 'show given year (default: current year)')
  .option('-a, --all', 'include archived dates')
  .option('--props <fields>', 'additionally displayed fields', cmdlist)
  .action(csv)

program
  .command('add <start> <end>')
  .description('add an entry')
  .option('-t, --type <value>')
  .option('-m, --message <value>')
  .action(add)

program
  .command('get [stamp]')
  .description('get the raw data')
  .action(get)

program
  .command('remove [stamp]')
  .alias('rm')
  .description('remove an entry')
  .action(remove)

program
  .command('set [stamp] <key> [value]')
  .usage('[options] [stamp] <key> <value>')
  .description('adjust time stamp boundaries or other properties')
  .action(set)

program
  .command('edit [stamp] [key]')
  .description('launch $EDITOR to edit the record')
  .action(edit)

program
  .command('move <stamp> [start]')
  .usage('[options] [stamp] <start>')
  .alias('mv')
  .description('move an entry to a new start')
  .action(move)

program
  .command('archive [stamp]')
  .description('archive a range or filtered set of clocked records or a specific stamp')
  .option('--filter <key=value>', 'filter by key, value as string or /regex/', collect, [])
  .option('-t, --type <value>', 'short for --filter "type=<value>"')
  .option('--gt <date>', 'archive dates from gt on')
  .option('--lt <date>', 'archive dates upto')
  .option('--day [value]', 'show given day (default: today)')
  .option('--week [value]', 'show given week (default: current week)')
  .option('--month [value]', 'show given month (default: current month)')
  .option('--year [value]', 'show given year (default: current year)')
  .action(archive)

program
  .command('unarchive [stamp]')
  .description('unarchive a range of clocked records or a specific stamp')
  .option('--gt <date>', 'unarchive dates from gt on')
  .option('--lt <date>', 'unarchive dates upto')
  .option('--day [value]', 'show given day (default: today)')
  .option('--week [value]', 'show given week (default: current week)')
  .option('--month [value]', 'show given month (default: current month)')
  .option('--year [value]', 'show given year (default: current year)')
  .action(unarchive)

program
  .command('help', {
    noHelp: true
  })
  .action(help)

// Show help if no command given
if (!argvs[0].slice(2).length) {
  program.help()
}

let clocker
program.parse(argvs[0])

function splitArgvs (argv) {
  // splits array on '--' value into array of arrays
  return argv.reduceRight((prev, curr) => {
    if (curr === '--') {
      prev.unshift([])
    } else {
      prev[0].unshift(curr)
    }
    return prev
  }, [[]])
}

function help () {
  program.help()
}

function start (cmd) {
  clocker = initialize(cmd)

  const data = {}
  ;['type', 'message'].forEach(function (prop) {
    if (cmd[prop]) {
      data[prop] = cmd[prop]
    }
  })

  if (argvs[1]) {
    argvs[1].forEach(function (prop) {
      prop = prop.replace(/^-+/, '')
      const [key, value] = prop.split('=')
      data[key] = value
    })
  }

  clocker.start(data, new Date(), nil)
}

function stop (stamp, cmd) {
  clocker = initialize(cmd)

  const data = {}
  ;['message'].forEach(function (prop) {
    if (cmd[prop]) {
      data[prop] = cmd[prop]
    }
  })

  if (cmd.type) {
    if (stamp) {
      ifError(new Error('stamp can\'t be used together with \'--type\' option'))
    }
    const filter = getFilter(cmd)
    clocker.data(filter, function (err, entries) {
      ifError(err)
      if (entries.length === 0) {
        ifError(new Error('no matching entries found'))
      }
      stamp = entries[entries.length - 1].key
      clocker.stop(stamp, data, nil)
    })
  } else {
    clocker.stop(stamp, data, nil)
  }
}

function restart (stamp, cmd) {
  clocker = initialize(cmd)

  clocker.restart(stamp, nil)
}

function list (cmd) {
  clocker = initialize(cmd)
  const filter = getFilter(cmd)

  if (cmd.report) {
    if (filter.lt && filter.gt && filter.lt.getTime() - filter.gt.getTime() === 24 * 60 * 60 * 1000) {
      console.log('Report for %s:', printDate(filter.gt))
    } else {
      console.log('Report for %s – %s:', printDate(filter.gt, 'open start'), printDate(filter.lt, 'open end'))
    }
  }

  const sumsByType = {}
  let totalSum = 0
  clocker.dataStream(filter).on('error', function (err) {
    ifError(err)
  }).on('end', function () {
    if (cmd.report) {
      console.log('')
      for (const stype in sumsByType) {
        console.log('%s: %s', stype, Clocker.formatElapsed(sumsByType[stype]))
        totalSum += sumsByType[stype]
      }
      console.log('\ntotal: %s', Clocker.formatElapsed(totalSum))
    }

    success()
  }).on('data', function (entry) {
    printEntry(entry)

    if (cmd.verbose) {
      printMessage(entry.data.message)
    }

    if (sumsByType[entry.data.type]) {
      sumsByType[entry.data.type] += entry.elapsed
    } else {
      sumsByType[entry.data.type] = entry.elapsed
    }
  })
}

function report (cmd) {
  cmd.day = cmd.reportDay ?? true
  cmd.report = true

  return list(cmd)
}

function csv (cmd) {
  clocker = initialize(cmd)
  const filter = getFilter(cmd)

  let additionalFields = []
  if (cmd.props) {
    additionalFields = cmd.props
  }

  // print header
  let header = 'Key,Date,Start,End,Duration,Archived,Type,Message'
  if (additionalFields.length) {
    header += ','
    header += additionalFields.join(',')
  }
  console.log(header)

  clocker.dataStream(filter).on('error', function (err) {
    ifError(err)
  }).on('end', function () {
    success()
  }).on('data', function (entry) {
    const data = entry.data || {}
    let output = '%s,%s,%s,%s,%s,%s,"%s","%s"'
    let fields = [
      entry.key,
      strftime('%F', entry.start),
      strftime('%T', entry.start),
      (entry.end === 'NOW' ? 'NOW' : strftime('%T', entry.end)),
      Clocker.formatElapsed(entry.elapsed),
      (data.archive ? 'A' : ''),
      (data.type || '').replace(/"/g, '""'),
      (data.message || '').replace(/"/g, '""')
    ]
    if (additionalFields.length) {
      output += ','
      output += additionalFields.map(function () { return '"%s"' }).join(',')

      fields = fields.concat(additionalFields.map(function (prop) {
        return (entry.data[prop] || '').toString().replace(/"/g, '""')
      }))
    }

    console.log.apply(null, [output].concat(fields))
  })
}

function status (stamp, cmd) {
  clocker = initialize(cmd)
  clocker.status(stamp, function (err, status) {
    ifError(err)
    console.log(status)
    success()
  })
}

function aggregateJson (cmd) {
  clocker = initialize(cmd)
  const filter = getFilter(cmd)

  clocker.aggregate('day', filter, function (err, data) {
    ifError(err)

    const json = {
      hours: [],
      title: 'consulting'
    }

    if (cmd.rate) {
      json.rate = cmd.rate
    }

    for (const date in data) {
      json.hours.push({
        date: date,
        hours: Math.round(data[date] / 36) / 100
      })
    }

    success([json])
  })
}

function get (stamp, cmd) {
  clocker = initialize(cmd)
  clocker.get(stamp, function (err, entry) {
    ifError(err)
    success(entry.data)
  })
}

function set (stamp, key, value, cmd) {
  if (typeof value === 'undefined') {
    // move properties since only stamp is optional
    value = key
    key = stamp
    stamp = undefined
  }

  clocker = initialize(cmd)
  clocker.set(stamp, key, value, nil)
}

function move (stamp, start, cmd) {
  if (typeof start === 'undefined') {
    // move properties since only stamp is optional
    start = stamp
    stamp = undefined
  }

  clocker = initialize(cmd)
  clocker.move(stamp, start, nil)
}

function add (start, end, cmd) {
  clocker = initialize(cmd)

  const data = {
    end: end
  }
  ;['type', 'message'].forEach(function (prop) {
    if (cmd[prop]) {
      data[prop] = cmd[prop]
    }
  })

  clocker.add(start, end, data, nil)
}

function remove (stamp, cmd) {
  clocker = initialize(cmd)
  clocker.remove(stamp, nil)
}

function setArchive (archive, stamp, cmd) {
  const value = (archive ? true : undefined)
  const clocker = initialize(cmd)

  if (!stamp && (cmd.lt || cmd.gt || cmd.filter || cmd.type)) {
    // (un)archive range
    cmd.all = !archive
    const filter = getFilter(cmd)

    // filter only for (un)archived records
    const oldTest = filter.test
    filter.test = (e) => {
      if (!oldTest(e)) {
        return false
      }
      if (!archive && (!e.data || !e.data.archive)) {
        return false
      }
      return true
    }

    const stamps = []
    clocker.dataStream(filter).on('error', function (err) {
      ifError(err)
    }).on('end', function () {
      each(stamps, function (stamp, cb) {
        clocker.set(stamp, 'archive', value, cb)
      }, nil)
    }).on('data', function (entry) {
      stamps.push(entry.key)
    })
  } else {
    clocker.set(stamp, 'archive', value, nil)
  }
}

function archive (stamp, cmd) {
  setArchive(true, stamp, cmd)
}

function unarchive (stamp, cmd) {
  setArchive(false, stamp, cmd)
}

function edit (stamp, prop, cmd) {
  if (cmd) {
    clocker = initialize(cmd)
  }

  clocker.get(stamp, function (err, obj) {
    if (err) {
      if (err.name === 'NotFoundError' && typeof stamp !== 'undefined' && typeof prop === 'undefined') {
        // stamp was just prop
        return edit(null, stamp, null)
      } else {
        ifError(err)
      }
    }

    obj.data = obj.data || {}
    if (obj.end && obj.end !== 'NOW') {
      obj.data.end = strftime('%F %T', obj.end)
    }

    let src = obj.data
    if (typeof prop !== 'undefined') {
      if (prop in obj.data) {
        src = obj.data[prop]
      } else {
        ifError(new Error(`Property not set: ${prop}`))
      }
    }

    src = stringify(src, {
      space: 2
    })
    editEntry(src, function (updated) {
      try {
        updated = JSON.parse(updated)
      } catch (err) {
        ifError(new Error('error parsing json'))
      }

      if (typeof prop !== 'undefined') {
        clocker.set(stamp, prop, updated, nil)
      } else {
        clocker.set(stamp, updated, nil)
      }
    })
  })
}

function initialize (cmd) {
  if (typeof cmd !== 'object') {
    program.outputHelp()
    process.exit(1)
  }
  return new Clocker({
    dir: datadir
  })
}

function getFilter (cmd) {
  const filter = {}
  cmd.filter = cmd.filter || []

  if (cmd.type) {
    cmd.filter.push('type=' + cmd.type)
  }

  cmd.filter.forEach((cmdFilter) => {
    const kv = cmdFilter.split('=')
    if (isRegex(kv[1])) {
      extendFilter(filter, (e) => RegExp(kv[1].slice(1, -1)).test(e.data[kv[0]]))
    } else {
      // string
      // ignore eslint rule "eqeqeq" to allow type-converting comparison
      extendFilter(filter, (e) => e.data[kv[0]] == kv[1]) // eslint-disable-line eqeqeq
    }
  })

  if (cmd.gt) {
    filter.gt = cmd.gt
  }
  if (cmd.lt) {
    filter.lt = cmd.lt
  }
  if (cmd.day) {
    let date = (cmd.day && typeof cmd.day === 'string') ? cmd.day : 'today'
    date = getDate(date)
    date = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const tomorrow = new Date(date.getTime() + (24 * 60 * 60 * 1000))
    filter.gt = date
    filter.lt = tomorrow
  }
  if (cmd.week) {
    let date = (cmd.week && typeof cmd.week === 'string') ? cmd.week : 'today'
    date = getDate(date)
    const day = date.getDay()
    const diff = date.getDate() - day + (day === 0 ? -6 : 1)
    date.setDate(diff)
    date.setHours(0)
    date.setMinutes(0)
    date.setSeconds(0)
    filter.gt = date
    filter.lt = new Date(date.getTime() + (7 * 24 * 60 * 60 * 1000))
  }
  if (cmd.month) {
    let date = (cmd.week && typeof cmd.week === 'string') ? cmd.week : 'today'
    date = getDate(date)
    filter.gt = new Date(date.getFullYear(), date.getMonth(), 1)
    filter.lt = new Date(date.getFullYear(), date.getMonth() + 1, 1)
  }
  if (cmd.year) {
    let date = (cmd.week && typeof cmd.week === 'string') ? cmd.week : 'today'
    date = getDate(date)
    filter.gt = new Date(date.getFullYear(), 0, 1)
    filter.lt = new Date(date.getFullYear() + 1, 0, 1)
  }

  if (!cmd.all) {
    // filter archived records
    extendFilter(filter, (e) => !(e.data && e.data.archive))
  }

  return filter
}

function extendFilter (filter, func) {
  if (!filter.test) {
    filter.test = func
    return
  }

  const oldTest = filter.test
  filter.test = (e) => (oldTest(e) && func(e))
}

function each (arr, cb, cbEnd) {
  if (arr.length === 0) {
    return cbEnd()
  }

  cb(arr.shift(), function (err) {
    if (err) {
      return cbEnd(err)
    }
    each(arr, cb, cbEnd)
  })
}

function nil (err) {
  ifError(err)
  success()
}

function editEntry (src, cb) {
  const file = path.join(tmpdir, 'clocker-' + Math.random())
  fs.writeFile(file, src || '', function (err) {
    ifError(err)

    editor(file, function (code, sig) {
      if (code !== 0) {
        ifError(new Error('non-zero exit code from $EDITOR'))
      }

      fs.readFile(file, function (err, src) {
        ifError(err)

        cb(src)
      })
    })
  })
}

function printEntry (entry) {
  const data = entry.data || {}

  console.log(
    '%s  %s  [ %s - %s ]  (%s)%s%s',
    entry.key,
    strftime('%F', entry.start),
    strftime('%T', entry.start),
    (entry.end === 'NOW' ? 'NOW' : strftime('%T', entry.end)),
    Clocker.formatElapsed(entry.elapsed),
    (data.type ? '  [' + data.type + ']' : ''),
    (data.archive ? ' A' : '')
  )
}

function printMessage (message) {
  if (message) {
    const lines = message.split('\n')
    console.log()
    lines.forEach(function (line) {
      console.log('    ' + line)
    })
    console.log()
  }
}

function printDate (date, defaultStr = 'n/a') {
  if (typeof date === 'undefined') {
    return defaultStr
  }

  if (typeof date === 'string') {
    date = getDate(date)
    return printDate(date)
  }

  const monthNames = [
    'January', 'February', 'March',
    'April', 'May', 'June', 'July',
    'August', 'September', 'October',
    'November', 'December'
  ]

  return date.getDate() + ' ' + monthNames[date.getMonth()] + ' ' + date.getFullYear()
}

function ifError (err) {
  if (err) {
    throw err
  }
}

function success (msg) {
  if (msg) {
    console.log(stringify(msg, { space: 2 }))
  }

  if (clocker) {
    clocker.close(function () {
      process.exit(0)
    })
  } else {
    process.exit(0)
  }
}

function isRegex (str) {
  return (str[0] === '/' && str.slice(-1)[0] === '/')
}

function cmdlist (val) {
  return val.split(',')
}

function collect (val, memo) {
  memo.push(val)
  return memo
}
