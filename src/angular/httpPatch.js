var utils = require('../instrumentation/utils')

module.exports = function ($provide, traceBuffer) {
  // HTTP Instrumentation
  var nextId = 0
  $provide.decorator('$http', ['$delegate', '$injector', function ($delegate, $injector) {
    return utils.instrumentModule($delegate, $injector, {
      type: 'ext.$http',
      prefix: '$http',
      traceBuffer: traceBuffer,
      instrumentConstructor: true,
      before: function (context) {
        context.taskId = 'http' + nextId
        if (window.zone.transaction) {
          window.zone.transaction.addTask(context.taskId)
        }
        nextId++
      },
      after: function (context) {
        if (window.zone.transaction) {
          window.zone.transaction.removeTask(context.taskId)
        }
      },
      signatureFormatter: function (key, args) {
        var text = ['$http']
        if (args.length) {
          if (args[0] !== null && typeof args[0] === 'object') {
            if (!args[0].method) {
              args[0].method = 'get'
            }
            text = ['$http', args[0].method.toUpperCase(), args[0].url]
          } else if (typeof args[0] === 'string') {
            text = ['$http', args[0]]
          }
        }
        return text.join(' ')
      }
    })
  }])
}
