
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

  it('can invoke a responder if no event is expecting an acknowledgment', function(done) {
    createWorker(function() {
      spawn.on('greet', function(name, responder) {
        responder('Hello, ' + name + '!');
      });
    });

    worker.emit('greet', 'James');
    expect(Object.keys(worker.acks).length).toBe(0);

    setTimeout(done, WORKER_TIMEOUT);
  });

  it('stops receiving events after being closed from the main thread', function(done) {
    createWorker(function() {
      spawn.on('ping', function(val, responder) {
        responder(val);
      });
    });

    worker.emit('ping', 'pong', function(result) {
      expect(result).toEqual('pong');
    });

    worker.close();

    var ack = jasmine.createSpy('ack');
    worker.emit('ping', 'pong', ack);

    setTimeout(function() {
      expect(ack).not.toHaveBeenCalled();
      done();
    }, WORKER_TIMEOUT);
  });

  it('stops receiving events after being closed from the worker thread', function(done) {
    createWorker(function() {
      spawn.on('ping', function(val, responder) {
        responder(val);
        spawn.close();
      });
    });

    worker.emit('ping', 'pong', function(result) {
      expect(result).toEqual('pong');
    });

    var ack = jasmine.createSpy('ack');
    worker.emit('ping', 'pong', ack);

    setTimeout(function() {
      expect(ack).not.toHaveBeenCalled();
      done();
    }, WORKER_TIMEOUT);
  });

  it('clears main thread callbacks when closed', function(done) {
    createWorker(function() {
      spawn.on('close', function(val, responder) {
        responder();
        spawn.close();
        spawn.emit('message1', false);
        spawn.emit('message1', false);
      });
    });

    var callback = jasmine.createSpy('callback');
    worker.on('message1', callback);
    worker.on('message2', callback);

    expect(worker.callbacks).toEqual({
      message1: [callback],
      message2: [callback]
    });

    worker.emit('close', function(val) {
      setTimeout(function() {
        expect(callback).not.toHaveBeenCalled();
        expect(worker.callbacks).toEqual({});
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
      spawn.on('wont invoke responder', function() {});
    });

    var ack = jasmine.createSpy('ack');
    worker.emit('wont invoke responder', ack);

    (function() {
      var keys = Object.keys(worker.acks);
      expect(keys.length).toBe(1);
      expect(worker.acks[keys.pop()]).toEqual(ack);
    })();

    worker.emit('close', function() {
      setTimeout(function() {
        expect(ack).not.toHaveBeenCalled();
        expect(worker.acks).toEqual({});
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
});