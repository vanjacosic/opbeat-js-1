var Trace = require('./trace')
var Promise = require('es6-promise').Promise

var Transaction = function (name, type, options) {
  this.metadata = {}
  this.name = name
  this.type = type
  this.ended = false
  this._markDoneAfterLastTrace = false
  this._isDone = false
  this._options = options

  this.traces = []
  this._activeTraces = {}

  this._scheduledTasks = {}

  Promise.call(this.donePromise = Object.create(Promise.prototype), function (resolve, reject) {
    this._resolve = resolve
    this._reject = reject
  }.bind(this.donePromise))

  // A transaction should always have a root trace spanning the entire transaction.
  this._rootTrace = this.startTrace('transaction', 'transaction', this._options)
  this._startStamp = this._rootTrace._startStamp
  this._start = this._rootTrace._start

  this.duration = this._rootTrace.duration.bind(this._rootTrace)
}

Transaction.prototype.startTrace = function (signature, type) {
  // todo: should not accept more traces if the transaction is alreadyFinished
  var trace = new Trace(this, signature, type, this._options)
  if (this._rootTrace) {
    trace.setParent(this._rootTrace)
  }

  this._activeTraces[trace.getFingerprint()] = trace

  return trace
}

Transaction.prototype.isFinished = function () {
  return (this.ended &&
  Object.keys(this._scheduledTasks).length === 0 &&
  Object.keys(this._activeTraces).length === 0)
}

Transaction.prototype.end = function () {
  if (this.ended) {
    return
  }

  this.ended = true
  this._rootTrace.end()

  if (this.isFinished() === true) {
    this._finish()
  }
  return this.donePromise
}

Transaction.prototype.addTask = function (taskId) {
  // todo: should not accept more tasks if the transaction is alreadyFinished
  this._scheduledTasks[taskId] = taskId
}

Transaction.prototype.removeTask = function (taskId) {
  delete this._scheduledTasks[taskId]
  if (this.isFinished() === true) {
    this._finish()
  }
}

Transaction.prototype.addEndedTraces = function (existingTraces) {
  this.traces = this.traces.concat(existingTraces)
}

Transaction.prototype._onTraceEnd = function (trace) {
  this.traces.push(trace)

  // Remove trace from _activeTraces
  delete this._activeTraces[trace.getFingerprint()]

  if (this.isFinished() === true) {
    this._finish()
  }
}

Transaction.prototype._finish = function () {
  if (this._alreadFinished === true) {
    return
  }

  this._adjustStartToEarliestTrace()
  this._adjustEndToLatestTrace()

  this._alreadFinished = true
  this.donePromise._resolve(this)
}

Transaction.prototype._adjustEndToLatestTrace = function () {
  var latestTrace = findLatestTrace(this.traces)
  if (typeof latestTrace !== 'undefined') {
    this._rootTrace._end = latestTrace._end
    this._rootTrace.calcDiff()
  }
}

Transaction.prototype._adjustStartToEarliestTrace = function () {
  var trace = getEarliestTrace(this.traces)

  if (trace) {
    this._rootTrace._start = trace._start
    this._rootTrace._startStamp = trace._startStamp
    this._rootTrace.calcDiff()

    this._startStamp = this._rootTrace._startStamp
    this._start = this._rootTrace._start
  }
}

function getEarliestTrace (traces) {
  var earliestTrace = null

  traces.forEach(function (trace) {
    if (!earliestTrace) {
      earliestTrace = trace
    }
    if (earliestTrace && earliestTrace._start > trace._start) {
      earliestTrace = trace
    }
  })

  return earliestTrace
}

function findLatestTrace (traces) {
  var latestTrace = null

  traces.forEach(function (trace) {
    if (!latestTrace) {
      latestTrace = trace
    }
    if (latestTrace && latestTrace._end < trace._end) {
      latestTrace = trace
    }
  })

  return latestTrace
}

module.exports = Transaction