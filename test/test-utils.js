const path = require('path')
const rimraf = require('rimraf')
const Clocker = require('../lib/index')

module.exports = {
  initialize () {
    var dataDir = path.join(__dirname, 'datadir')

    // Empty db dir
    rimraf.sync(path.join(dataDir, 'db'))

    // Initialize clocker
    var clocker = new Clocker({
      dir: dataDir
    })

    return clocker
  }
}
