const path = require('path')
const rimraf = require('rimraf')
const Clocker = require('../lib/index')

function initializeClocker () {
  const dataDir = initializeDB()
  return new Clocker({
    dir: dataDir
  })
}

function initializeDB () {
  const dataDir = path.join(__dirname, 'datadir')
  // Empty db dir
  rimraf.sync(path.join(dataDir, 'db'))
  return dataDir
}

module.exports = {
  initializeClocker,
  initializeDB
}
