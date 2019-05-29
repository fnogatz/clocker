const path = require('path')
const rimraf = require('rimraf')
const {spawnSync} = require('child_process')
const Clocker = require('../lib/index')

let dataDir

function initializeClocker () {
  _initializeDB()
  return new Clocker({
    dir: dataDir
  })
}

function createCLIWrapper () {
  _initializeDB()
  return {
    run: _runCLICommand
  }
}

function _initializeDB () {
  dataDir = path.join(__dirname, 'datadir')
  // Empty db dir
  rimraf.sync(path.join(dataDir, 'db'))
}

function _runCLICommand (command) {
  return spawnSync('./bin/index.js', [...command, '-d', dataDir], {encoding: 'utf-8'})
}

module.exports = {
  initializeClocker,
  createCLIWrapper
}
