#!/usr/bin/env node

var path = require('path')
var os = require('os')
var fs = require('fs')
var program = require('commander')
var strftime = require('strftime')
var editor = require('editor')
var stringify = require('json-stable-stringify')
var tmpdir = os.tmpdir()

var Clocker = require('../lib/index')
var util = require('../lib/util')
var getDate = util.getDate

var argvs = splitArgvs(process.argv)

program
  .name('clocker')
  .version(require('../package.json').version)
  .description('track project hours')

// Adjust help output for set command
//   as it has two optional arguments,
//   which cannot be handled by commander
var outputHelp = program.outputHelp.bind(program)
program.outputHelp = function (cb) {
  cb = cb || function (passthru) { return passthru }
  var newCb = function (text) {
    return cb(text).replace('set [options] [stamp] <key> [value]', 'set [options] [stamp] <key> <value>')
  }
  outputHelp(newCb)
}

program
  .command('start')
  .usage('[options] [-- <data>]')
  .description('start the clock')
  .option('-d, --datadir <path>')
  .option('-t, --type <value>')
  .option('-m, --message <value>')
  .action(start)

program
  .command('stop [stamp]')
  .description('stop the clock')
  .option('-d, --datadir <path>')
  .option('-t, --type <value>', 'use latest of type instead of stamp')
  .option('-m, --message <value>')
  .action(stop)

program
  .command('restart [stamp]')
  .description('restart the clock')
  .option('-d, --datadir <path>')
  .action(restart)

program
  .command('status [stamp]')
  .description('show the elapsed time')
  .option('-d, --datadir <path>')
  .action(status)

program
  .command('data')
  .description('generate invoicer-compatible json output')
  .option('-d, --datadir <path>')
  .option('--filter <key=value>', 'filter by key, value as string or /regex/', collect, [])
  .option('-t, --type <value>', 'short for --filter "type=<value>"')
  .option('--gt <date>', 'show dates from gt on')
  .option('--lt <date>', 'show dates upto')
  .option('-r, --rate <value>', 'add rate property', parseFloat)
  .option('-a, --all', 'include archived dates')
  .action(aggregateJson)

program
  .command('list')
  .alias('ls')
  .description('show data entries')
  .option('-d, --datadir <path>')
  .option('-v, --verbose', 'also show clocked messages')
  .option('--filter <key=value>', 'filter by key, value as string or /regex/', collect, [])
  .option('-t, --type <value>', 'short for --filter "type=<value>"')
  .option('--gt <date>', 'show dates from gt on')
  .option('--lt <date>', 'show dates upto')
  .option('-a, --all', 'include archived dates')
  .action(list)

program
  .command('report')
  .description('show all logged hours of a specific day')
  .option('-d, --datadir <path>')
  .option('-v, --verbose', 'also show clocked messages')
  .option('--reportDay <value>', 'day to use')
  .option('-a, --all', 'include archived dates')
  .action(report)

program
  .command('csv')
  .description('generate CSV output')
  .option('-d, --datadir <path>')
  .option('--filter <key=value>', 'filter by key, value as string or /regex/', collect, [])
  .option('-t, --type <value>', 'short for --filter "type=<value>"')
  .option('--gt <date>', 'show dates from gt on')
  .option('--lt <date>', 'show dates upto')
  .option('-a, --all', 'include archived dates')
  .option('--props <fields>', 'additionally displayed fields', cmdlist)
  .action(csv)

program
  .command('add <start> <end>')
  .description('add an entry')
  .option('-d, --datadir <path>')
  .option('-t, --type <value>')
  .option('-m, --message <value>')
  .action(add)

program
  .command('get [stamp]')
  .description('get the raw data')
  .option('-d, --datadir <path>')
  .action(get)

program
  .command('remove [stamp]')
  .alias('rm')
  .description('remove an entry')
  .option('-d, --datadir <path>')
  .action(remove)

program
  .command('set [stamp] <key> [value]')
  .usage('[options] [stamp] <key> <value>')
  .description('adjust time stamp boundaries or other properties')
  .option('-d, --datadir <path>')
  .action(set)

program
  .command('edit [stamp] [key]')
  .description('launch $EDITOR to edit the record')
  .option('-d, --datadir <path>')
  .action(edit)

program
  .command('move <stamp> [start]')
  .usage('[options] [stamp] <start>')
  .alias('mv')
  .description('move an entry to a new start')
  .option('-d, --datadir <path>')
  .action(move)

program
  .command('archive [stamp]')
  .description('archive a range or filtered set of clocked records or a specific stamp')
  .option('-d, --datadir <path>')
  .option('--filter <key=value>', 'filter by key, value as string or /regex/', collect, [])
  .option('-t, --type <value>', 'short for --filter "type=<value>"')
  .option('--gt <date>', 'archive dates from gt on')
  .option('--lt <date>', 'archive dates upto')
  .action(archive)

program
  .command('unarchive [stamp]')
  .description('unarchive a range of clocked records or a specific stamp')
  .option('-d, --datadir <path>')
  .option('--gt <date>', 'unarchive dates from gt on')
  .option('--lt <date>', 'unarchive dates upto')
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

program.parse(argvs[0])

var clocker

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

  var data = {}
  ;['type', 'message'].forEach(function (prop) {
    if (cmd[prop]) {
      data[prop] = cmd[prop]
    }
  })

  if (argvs[1]) {
    argvs[1].forEach(function (prop) {
      prop = prop.replace(/^-+/, '')
      var [key, value] = prop.split('=')
      data[key] = value
    })
  }

  clocker.start(data, new Date(), nil)
}

function stop (stamp, cmd) {
  clocker = initialize(cmd)

  var data = {}
  ;['message'].forEach(function (prop) {
    if (cmd[prop]) {
      data[prop] = cmd[prop]
    }
  })

  if (cmd.type) {
    if (stamp) {
      ifError(new Error(`stamp can't be used together with '--type' option`))
    }
    var filter = getFilter(cmd)
    clocker.data(filter, function (err, entries) {
      ifError(err)
      if (entries.length === 0) {
        ifError(new Error(`no matching entries found`))
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
  var filter = getFilter(cmd)

  clocker.dataStream(filter).on('error', function (err) {
    ifError(err)
  }).on('end', function () {
    success()
  }).on('data', function (entry) {
    printEntry(entry)

    if (cmd.verbose) {
      printMessage(entry.data.message)
    }
  })
}

function report (cmd) {
  clocker = initialize(cmd)
  var filter = getFilter(cmd)

  var reportDay = (cmd.reportDay && typeof cmd.reportDay === 'string') ? cmd.reportDay : 'today'
  reportDay = getDate(reportDay)
  var reportDayTomorrow = new Date(reportDay.getTime() + (24 * 60 * 60 * 1000))
  filter.gt = reportDay
  filter.lt = reportDayTomorrow

  console.log('Report for %s:', printDate(reportDay))

  var sumsByType = {}
  var totalSum = 0
  clocker.dataStream(filter).on('error', function (err) {
    ifError(err)
  }).on('end', function () {
    console.log('')
    for (var stype in sumsByType) {
      console.log('%s: %s', stype, Clocker.formatElapsed(sumsByType[stype]))
      totalSum += sumsByType[stype]
    }
    console.log('\ntotal: %s', Clocker.formatElapsed(totalSum))

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

function csv (cmd) {
  clocker = initialize(cmd)
  var filter = getFilter(cmd)

  var additionalFields = []
  if (cmd.props) {
    additionalFields = cmd.props
  }

  // print header
  var header = 'Key,Date,Start,End,Duration,Archived,Type,Message'
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
    var data = entry.data || {}
    var output = '%s,%s,%s,%s,%s,%s,"%s","%s"'
    var fields = [
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
  var filter = getFilter(cmd)

  clocker.aggregate('day', filter, function (err, data) {
    ifError(err)

    var json = {
      hours: [],
      title: 'consulting'
    }

    if (cmd.rate) {
      json.rate = cmd.rate
    }

    for (var date in data) {
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

  var data = {
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
  var value = (archive ? true : undefined)
  var clocker = initialize(cmd)

  if (!stamp && (cmd.lt || cmd.gt || cmd.filter || cmd.type)) {
    // (un)archive range
    cmd.all = !archive
    var filter = getFilter(cmd)

    // filter only for (un)archived records
    var oldTest = filter.test
    filter.test = (e) => {
      if (!oldTest(e)) {
        return false
      }
      if (!archive && (!e.data || !e.data.archive)) {
        return false
      }
      return true
    }

    var stamps = []
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

    var src = obj.data
    if (typeof prop !== 'undefined') {
      if (obj.data.hasOwnProperty(prop)) {
        src = obj.data[prop]
      } else {
        ifError(new Error('Property not set: ' + prop))
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
    dir: dir(cmd)
  })
}

function getFilter (cmd) {
  var filter = {}
  cmd.filter = cmd.filter || []

  if (cmd.type) {
    cmd.filter.push('type=' + cmd.type)
  }

  cmd.filter.forEach((cmdFilter) => {
    var kv = cmdFilter.split('=')
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

  var oldTest = filter.test
  filter.test = (e) => (oldTest(e) && func(e))
}

function dir (cmd) {
  if (cmd.datadir) {
    return cmd.datadir
  }

  var HOME = process.env.HOME || process.env.USERPROFILE
  var defaultDataDir = path.join(HOME, '.clocker')
  return defaultDataDir
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
  var file = path.join(tmpdir, 'clocker-' + Math.random())
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
  var data = entry.data || {}

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
    var lines = message.split('\n')
    console.log()
    lines.forEach(function (line) {
      console.log('    ' + line)
    })
    console.log()
  }
}

function printDate (date) {
  if (typeof date === 'string') {
    date = getDate(date)
    return printDate(date)
  }

  var monthNames = [
    'January', 'February', 'March',
    'April', 'May', 'June', 'July',
    'August', 'September', 'October',
    'November', 'December'
  ]

  return date.getDate() + ' ' + monthNames[date.getMonth()] + ' ' + date.getFullYear()
}

function ifError (err) {
  if (err) {
    console.log(`Error: ${err.message}`)

    if (clocker) {
      clocker.close(function () {
        process.exit(1)
      })
    } else {
      process.exit(1)
    }
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
