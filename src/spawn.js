(function(root, factory) {

  // universal module definition
  if ('function' === typeof define && define.amd) {
    // AMD
    define([], factory);
  } else if ('object' === typeof exports) {
    // CommonJS
    module.exports = factory();
  } else {
    // browser global
    root.spawn = factory();
  }

})(this, function spawnFactory() {
  'use strict';

  // keep em close
  var Worker = window.Worker;
  var URL = window.URL || window.webkitURL;

  /**
   * Used for generating an worker with an empty body in
   * the case that a source path is provided
   */
  var noop = function() {};

  /**
   * @param {(string|Function)} src - worker source
   * @constructor
   */
  function Spawn(src) {
    this.isMainThread = true;

    var fn;

    if ('string' === typeof src) {
      fn = noop;
    } else if ('function' === typeof src) {
      fn = src;
      src = null;
    }

    this.file = URL.createObjectURL(new Blob([
      spawnWorkerSourceCode + '(' + fn.toString() + ').call(self);'
    ], {
      type: 'text/javascript'
    }));

    this.worker = new Worker(this.file);
    this._init();

    // import the worker src if src was a string
    if (src) {
      this.importScripts(src);
    }
  }

  // mins a little better
  Spawn.fn = Spawn.prototype;

  /**
   * Creates a relatively safe UUID
   * @return {string}
   */
  Spawn.fn.uuid = function() {
    var prefix = this.isMainThread ? 'spawn_' : 'worker_';
    return prefix + Date.now().toString(32) + Math.random().toString(32);
  };

  /**
   * Main thread location information that is shared with
   * workers. Generated workers report an href of the form
   * `blob:http://srv/06af73c7-df3e-4c78-867e-937f829949c7`
   * which breaks relative path calls to importScripts
   *
   * Using spawn's utility method `importScripts` prefixes relative
   * script paths with the main threads href, solving this problem
   */
  Spawn.fn.location = {
    origin: location.origin,
    originPath: location.href.match(/^(.*\/)?(?:$|(.+?)(?:(\.[^.]*$)|$))/)[1].
      replace(/\/?$/, '') + '/'
  };

  /**
   * Add an event listener for a given event
   *
   * @param {(Object|string)} event
   * @param {Function} handler
   * @return {Spawn}
   */
  Spawn.fn.on = function(event, handler) {
    if ('object' === typeof event) {
      for (var e in event) {
        if (Object.prototype.hasOwnProperty.call(event, e)) {
          this.on(e, event[e]);
        }
      }
    } else {
      this.callbacks[event] = this.callbacks[event] || [];
      this.callbacks[event].push(handler);
    }
    return this;
  };

  /**
   * Triggers an event passing on data to the listeners. If an ackCallback is
   * provided it will be called with the value passed to a listeners responder
   *
   * @param {string} event
   * @param {*=} data
   * @param {Function=} ackCallback
   * @return {Spawn}
   */
  Spawn.fn.emit = function(event, data, ackCallback, /* @private */ id) {
    var ack = false;
    if ('function' === typeof data) {
      ackCallback = data;
      data = null;
    } else if ('string' === typeof ackCallback) {
      id = ackCallback;
    }
    id = id || this.uuid();
    if ('function' === typeof ackCallback) {
      this.acks[id] = ackCallback;
      ack = true;
    }
    this.worker.postMessage({
      id: id,
      event: event,
      data: data,
      ack: ack
    });
    return this;
  };

  /**
   * Executes listeners attached to an event. If data is provided it will
   * be passed to every listener upon execution
   *
   * @param {string} event
   * @param {*} data
   * @param {number} id
   * @param {boolean} ack
   * @api private
   */
  Spawn.fn._invoke = function(event, data, id, ack) {
    var fns = this.callbacks[event];
    var self = this;

    if (fns) {
      var length = fns.length,
        index = -1;
      while (++index < length) {
        fns[index](data, responder);
      }
    }

    // If the responder is invoked and the event can be acknowledged
    // then we must notify the emitter, passing on the data provided
    function responder(data) {
      if (ack) {
        self.emit('spawn_ack', data, id);
      }
    }
  };

  /**
   * Discards any tasks queued in the worker's event loop,
   * effectively closing the worker
   *
   * @return {Spawn}
   */
  Spawn.fn.close = function() {
    if (this.isWorker) {
      this.emit('spawn_close');
      this.worker.close();
    } else {
      this.worker.terminate();
    }
    this.acks = {};
    this.callbacks = {};
    this.worker.onerror = this.worker.onmessage = null;
    URL.revokeObjectURL(this.file);
    return this;
  };

  /**
   * Imports one or more scripts into the worker's scope
   *
   * @param {...string} var_args - scripts to import
   * @return {Spawn}
   */
  Spawn.fn['import'] =
  Spawn.fn.importScripts = function() {
    var args = Array.prototype.slice.call(arguments, 0);

    if (this.isMainThread) {
      this.emit('spawn_import', args);
    } else {
      var length = args.length,
        index = -1,
        arg;

      while (++index < length) {
        arg = args[index];
        if ('/' === arg.charAt(0)) {
          args[index] = this.location.origin + arg;
        } else if (!/^https?:/.test(arg)) {
          args[index] = this.location.originPath + arg;
        }
      }

      importScripts.apply(self, args);
    }

    return this;
  };

  /**
   * Initialize Spawn
   * @api private
   */
  Spawn.fn._init = function() {
    var self = this;

    self.acks = {};
    self.callbacks = {};

    self.worker.onmessage = function(e) {
      var data = e.data.data;
      var event = e.data.event;
      var id = e.data.id;

      switch (event) {
        case 'spawn_ack':
          self.acks[id](data);
          delete self.acks[id];
          break;
        case 'spawn_import':
          self.importScripts.apply(self, data);
          break;
        case 'spawn_close':
          self.close();
          break;
        default:
          self._invoke(event, data, id, e.data.ack);
      }
    };

    if (self.isMainThread) {
      /**
       * Deal with errors on the main thread so we have the option
       * of calling the ErrorEvent's `preventDefault()` method
       */
      self.worker.onerror = function(event) {
        self._invoke('error', event);
      };
    }
  };

  /**
   * Generate Spawn worker source code from .. Spawn
   */
  var spawnWorkerSourceCode = (function() {

    // Stringify Spawn's prototype so it
    // can be used in the worker source code
    var spawnPrototypeSource = Object.keys(Spawn.fn).
      reduce(function(src, fn) {
        var val = Spawn.fn[fn];
        if ('function' === typeof val) {
          val = val.toString();
        } else {
          val = JSON.stringify(val);
        }
        return src + 'Spawn.fn.' + fn + '=' + val + ';';
      }, '');

    return [
      'self.spawn = (function() {',
        'function Spawn() {',
          'this.isWorker = true;',
          'this.worker = self;',
          'this._init();',
        '}',
        'Spawn.fn=Spawn.prototype;',
        spawnPrototypeSource,
        'return new Spawn;',
      '})();'
    ].join('\n');
  })();

  return function spawn(src) {
    return new Spawn(src);
  };
});