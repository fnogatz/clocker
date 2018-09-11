#!/usr/bin/env node

var path = require('path')
var program = require('commander')
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

program.parse(process.argv)

function start (cmd) {
  var clocker = new Clocker({
    dir: dir(cmd)
  })

  clocker.start({}, new Date(), started)
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
