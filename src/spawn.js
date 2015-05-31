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

  // RegExp that matches comments
  var COMMENTS_RE = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;

  // RegExp that matches the outer most function, capturing the body
  var FUNCTION_BODY_RE = /^function\s*[^{]*\{([\s\S]*)\}$/m;

  /**
   * Returns the body of a function
   * @param {Function} fn
   */
  var getFunctionBody = function(fn) {
    return fn.toString().replace(COMMENTS_RE, '').replace(FUNCTION_BODY_RE, '$1');
  };

  /**
   * Creates a javascript file/objectURL from `source`
   * @param {string} source
   */
  var createFile = function(source) {
    return URL.createObjectURL(new Blob([source], {
      type: 'application/javascript'
    }));
  };

  /**
   * @param {(string|Function)} src - worker source
   * @constructor
   */
  function Spawn(src) {
    this.isMainThread = true;

    var file;
    var code = '';

    if ('string' === typeof src) {
      file = src;
    } else if ('function' === typeof src) {
      code = getFunctionBody(src);
    }

    this.file = createFile("importScripts('" + spawnWorkerURL + "');\n" + code);
    this.worker = new Worker(this.file);
    this._init();

    if (file) {
      this.importScripts(file);
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
    origin: location.origin || location.protocol + '//' + location.host,
    originPath: location.href.match(/^(.*\/)?(?:$|(.+?)(?:(\.[^.]*$)|$))/)[1].
      replace(/\/?$/, '') + '/'
  };

  /**
   * Add an event listener for a given event
   *
   * @param {string} event
   * @param {Function} handler
   * @return {Spawn}
   */
  Spawn.fn.on = function(event, handler) {
    this.callbacks[event] = this.callbacks[event] || [];
    this.callbacks[event].push(handler);
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
        fns[index].call(self, data, responder);
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
      this.closed = true;
      this.worker.terminate();
      URL.revokeObjectURL(this.file);

      // make it a noop
      this.on = this.emit = this.close =
        this['import'] = this.importScripts = function() {
          // consider warning about calling these after the
          // worker has been closed
          return this;
        };

      // null it out
      this.worker.onerror = this.worker.onmessage =
        this.acks = this.callbacks = this.file = this.worker = null;
    }
    return this;
  };

  /**
   * Imports one or more scripts into the worker's scope
   *
   * @param {...string} var_args - scripts to import
   * @return {Spawn}
   */
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
      var fn;

      switch (event) {
        case 'spawn_ack':
          fn = self.acks[id];
          delete self.acks[id];
          fn.call(self, data);
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
  var spawnWorkerURL = (function() {

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

    return createFile(
      'self.spawn = (function() {' +
        'function Spawn() {' +
          'this.isWorker = true;' +
          'this.worker = self;' +
          'this._init();' +
        '}' +
        'Spawn.fn=Spawn.prototype;' +
        spawnPrototypeSource +
        'return new Spawn;' +
      '})();'
    );
  })();

  return function spawn(src) {
    return new Spawn(src);
  };
});