#!/usr/bin/env node

var path = require('path')
var program = require('commander')
var strftime = require('strftime')
var Clocker = require('../lib/index')

program
  .version(require('../package.json').version)
  .description('track project hours')

program
  .command('start')
  .description('start the clock')
  .option('-d, --datadir <path>')
  .option('-t, --type <value>')
  .option('-m, --message <value>')
  .action(start)

program
  .command('list')
  .description('show data entries')
  .option('-d, --datadir <path>')
  .action(list)

program.parse(process.argv)

function start (cmd) {
  var clocker = initialize(cmd)

  clocker.start({}, new Date(), started)
}

function list (cmd) {
  var clocker = initialize(cmd)

  clocker.dataStream({}).on('error', function (err) {
    console.log(err)
    process.exit(1)
  }).on('end', function () {
    process.exit(0)
  }).on('data', function (entry) {
    printEntry(entry)
  })
}

function initialize (cmd) {
  return new Clocker({
    dir: dir(cmd)
  })
}

function dir (cmd) {
  if (cmd.datadir) {
    return cmd.datadir
  }

  var HOME = process.env.HOME || process.env.USERPROFILE
  var defaultDataDir = path.join(HOME, '.clocker2')
  return defaultDataDir
}

function started (err, stamp) {
  if (err) {
    console.log(err)
    return process.exit(1)
  }

  console.log('Started: ' + stamp)
  process.exit(0)
}

function printEntry (data) {
  console.log(
    '%s  %s  [ %s - %s ]  (%s)%s%s',
    data.key,
    strftime('%F', data.start),
    strftime('%T', data.start),
    (data.end === 'NOW' ? 'NOW' : strftime('%T', data.end)),
    Clocker.formatElapsed(data.elapsed),
    (data.type ? '  [' + data.type + ']' : ''),
    (data.archive ? ' A' : '')
  )
}
