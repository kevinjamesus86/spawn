
describe('window', function() {

  it('.URL exists', function() {
    expect(window.URL).toBeDefined();
  });

  it('.Blob exists', function() {
    expect(window.Blob).toBeDefined();
  });

  it('.Worker exists', function() {
    expect(window.Worker).toBeDefined();
  });

});

describe('spawn', function() {
  var worker;

  function createWorker(src) {
    worker = spawn(src);
  }

  afterEach(function() {
    worker.close();
    worker = null;
  });

  it('can be called with a function', function() {
    function init() {
      createWorker(function() {});
    }
    expect(init).not.toThrow();
  });

  it('unwraps an obnoxious function', function(done) {
    function init() {
      createWorker(function fn /* why */ ($1, /* would *\/* */$2,
        /** anyone
         *  everrr
         */ $do
         // this
          ) /** :{ **/ {

        // make sure it actually gets this code
        spawn.on('test', function(_, responder) {
          responder( 'function' === typeof weirdFormatting );
        });

        // and captures to the very last `}`
        function weirdFormatting() {
          // it ends on the next line intentionally
      }});
    }

    expect(init).not.toThrow();

    worker.emit('test', function(weirdFormattingIsFunction) {
      expect(weirdFormattingIsFunction).toBe(true);
      done();
    });
  });

  it('does not create a closure when creating a worker from a function', function(done) {
    createWorker(function() {
      var $name = 'kevin';

      spawn.on('is global', function(varName, responder) {
        responder( 'undefined' != typeof self[varName] );
      });
    });

    worker.emit('is global', '$name', function($nameIsGlobal) {
      expect($nameIsGlobal).toBe(true);
      done();
    });
  });

  it('can be called with a file path', function(done) {
    var timer;

    createWorker('base/test/import.x2.js');

    worker.on('error', function(errorEvent) {
      errorEvent.preventDefault();
      // this will not pass..
      expect(errorEvent).toBeUndefined();

      clearTimeout(timer);
      done();
    });

    timer = setTimeout(done, 100);
  });

  it('imports file contents into the DedicatedWorkerGlobalScope', function(done) {
    createWorker(function() {
      spawn.on('x2', function(val, responder) {
        responder(x2(val));
      });
    });

    worker.importScripts('base/test/import.x2.js');

    worker.emit('x2', 10, function(val) {
      expect(val).toBe(20);
      done();
    });
  });

});

describe('worker', function() {
  var worker;
  var WORKER_TIMEOUT = 15;

  function createWorker(src) {
    worker = spawn(src);
  }

  afterEach(function() {
    worker.close();
    worker = null;
  });

  it('emits events', function(done) {
    createWorker(function() {
      spawn.emit('connected');
    });

    worker.on('connected', done);
  });

  it('emits errors on the main thread', function(done) {
    createWorker(function() {
      throw 'ERR';
    });

    worker.on('error', function(event) {
      event.preventDefault();
      expect(event instanceof ErrorEvent).toBe(true);
      done();
    });
  });

  it('emits events with simple data', function(done) {
    createWorker(function() {
      spawn.emit('simple data', 10);
    });

    worker.on('simple data', function(val) {
      expect(val).toEqual(10);
      done();
    });
  });

  it('emits events with complex data', function(done) {
    createWorker(function() {
      spawn.emit('complex data', {
        a: false,
        b: {
          c: ['Kevin']
        }
      });
    });

    worker.on('complex data', function(val) {
      expect(val).toEqual({
        a: false,
        b: {
          c: ['Kevin']
        }
      });
      done();
    });
  });

  it('acknowledges events with a responder', function(done) {
    createWorker(function() {
      spawn.on('message', function(data, responder) {
        responder();
      });
    });

    worker.emit('message', done);
  });

  it('responders can pass data to an event acknowledgment callback', function(done) {
    createWorker(function() {
      spawn.on('greet', function(name, responder) {
        responder('Hello, ' + name + '!');
      });
    });

    worker.emit('greet', 'Kevin', function(greeting) {
      expect(greeting).toEqual('Hello, Kevin!');
      done();
    });
  });

  it('stops receiving events after being closed from the main thread', function(done) {
    createWorker(function() {
      spawn.on('ping', function(_, responder) {
        responder();
      });
    });

    var ack = jasmine.createSpy('ack');

    worker.emit('ping', ack);
    worker.emit('ping', ack);
    worker.close();

    expect(ack).not.toHaveBeenCalled();
    expect(worker.acks).toEqual(null);
    done();
  });

  it('stops receiving events after being closed from the worker thread', function(done) {
    createWorker(function() {
      spawn.on('ping', function(_, responder) {
        responder();
        spawn.close();
      });
    });

    var ack = jasmine.createSpy('ack');

    worker.emit('ping', ack);
    worker.emit('ping', ack);

    setTimeout(function() {
      expect(ack.calls.count()).toBe(1);
      done();
    }, WORKER_TIMEOUT);
  });

  it('clears main thread callbacks when closed', function(done) {
    createWorker(function() {
      spawn.on('close', function(val, responder) {
        responder();
        spawn.close();
      });
    });

    function callback(){}
    worker.on('message', callback);
    expect(worker.callbacks).toEqual({
      message: [callback]
    });

    worker.emit('close', function(val) {
      setTimeout(function() {
        expect(worker.callbacks).toEqual(null);
        done();
      }, WORKER_TIMEOUT);
    });
  });

  it('clears main threads outstanding acknowledgments when closed', function(done) {
    createWorker(function() {
      spawn.on('close', function(val, responder) {
        responder();
        spawn.close();
      });
    });

    function ack(){}
    worker.emit('msg', ack);

    (function() {
      var keys = Object.keys(worker.acks);
      expect(keys.length).toBe(1);
      expect(worker.acks[keys.pop()]).toEqual(ack);
    })();

    worker.emit('close', function() {
      setTimeout(function() {
        expect(worker.acks).toEqual(null);
        done();
      }, WORKER_TIMEOUT);
    });
  });

  it('imports file contents into the DedicatedWorkerGlobalScope', function(done) {
    createWorker(function() {
      spawn.importScripts('base/test/import.x2.js');

      spawn.on('x2', function(val, responder) {
        responder(x2(val));
      });
    });

    worker.emit('x2', 10, function(val) {
      expect(val).toBe(20);
      done();
    });
  });

  it('can have it\'s own `onmessage` handler', function(done) {
    createWorker(function() {
      onmessage = function() {
        spawn.emit('self.onmessage');
      };
      spawn.on('test', function(_, responder) {
        // make sure this runs after the `onmessage` handler above
        setTimeout(responder);
      });
    });

    var callback = jasmine.createSpy('callback');
    worker.on('self.onmessage', callback);

    worker.emit('test', function() {
      expect(callback).toHaveBeenCalled();
      done();
    });
  });
});