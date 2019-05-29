const test = require('tape')
const {createCLIWrapper} = require('./test-utils')
const strftime = require('strftime')

test('report', t => {
  t.plan(1)
  t.test('verbose mode', t => {
    const wrapper = createCLIWrapper()
    const today = strftime('%Y-%m-%d', Date())
    wrapper.run(['add', today + ' 08:00:00', today + ' 10:30:00', '-m', 'Sample message.'])
    const reportResult = wrapper.run(['report', '-v'])
    t.ok(reportResult.stdout.includes('Sample message.'))
    t.end()
  })
})
