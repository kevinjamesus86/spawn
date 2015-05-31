# spawn [![Codacy Badge](https://www.codacy.com/project/badge/4a6d5150e5834dcf94bc08177422e14e)](https://www.codacy.com/app/kevinjamesus86/spawn)
_event-driven web workers for modern browsers_

### Download

+ JS
 - [spawn.js](https://raw.githubusercontent.com/kevinjamesus86/spawn/master/dist/spawn.js) big, or
 - [spawn.min.js](https://raw.githubusercontent.com/kevinjamesus86/spawn/master/dist/spawn.min.js) small

## Install

```html
<script src="https://cdn.rawgit.com/kevinjamesus86/spawn/v0.2.0/dist/spawn.js"></script>
or
<script src="https://cdn.rawgit.com/kevinjamesus86/spawn/v0.2.0/dist/spawn.min.js"></script>
```

## Usage

### Function as the source

```js
// create a worker with a
// function as the source
var worker = spawn(
  function workerThreadSource() {

    // it could take time..
    function fib(num) {
      if (num < 2) {
        return num;
      } else {
        return fib(num - 1) + fib(num - 2);
      }
    }

    // listen for the `fib` event
    spawn.on('fib', function(val, send) {

      // send the result back to the emitter
      send( fib(val) );
    });

  }
);

// emit an event and send some data to the worker
worker.emit('fib', 42, function(result) {

  // the *async* result of our workers labor
  console.log('the fib of 42 is:', result);

  // close if/when you're done with it
  this.close();
});
```

### File as the source

_fib.js_

```js
// it could take time..
function fib(num) {
  if (num < 2) {
    return num;
  } else {
    return fib(num - 1) + fib(num - 2);
  }
}

// listen for the `fib` event
spawn.on('fib', function(val, send) {

  // send the result back to the emitter
  send( fib(val) );
});
```

_app.js_

```js
// create the worker
var worker = spawn('fib.js');

// emit an event and send some data to the worker
worker.emit('fib', 42, function(result) {

  // the *async* result of our workers labor
  console.log('the fib of 42 is:', result);

  // close if/when you're done with it
  this.close();
});
```

## API

#### `spawn(source: {Function|string})`

Spawns a new worker from a function or file path. Functions passed as the
source will be unwrapped and executed in the workers global scope. File paths
passed as the source will be imported and executed in the workers global scope.

```js
var maths = spawn(
  function mathsSource() {

    // Round a value towards zero
    spawn.on('fix', function fix(num, send) {
      send( num > 0 ? Math.floor(num) : Math.ceil(num) );
    });

  }
);
```

  - **`on(event: string, handler: Function(data: any, send: Function))`**

    Adds an event handler for a given event. The handler function receives two
    arguments: data passed from the emitter, and a function for sending
    data back to the emitter.

  - **`emit(event: string [, data: any][, callback: Function(data: any)])`**

    Triggers an event passing on data to the listeners. The callback function
    receives one argument: data sent from the event listener that was triggered
    by the emitted event.

    ```js
    spawn(function() {

      spawn.emit('open', 'yap');

    }).on('open', function(msg) {
      console.log('Worker is ready, and says "' + msg + '"');
      this.close();
    });

    spawn(function() {

      spawn.on('reverse', function(str, send) {
        send( str.split('').reverse().join('') );
      });

    }).emit('reverse', 'racecar', function(val) {
      console.log('"racecar" backwards is "' + val + '"');
      this.close();
    });
    ```

  - **`close()`**

    Discards any tasks queued in the worker's event loop, effectively closing
    the worker.

  - **`importScripts(script: string [, ...])`**

    Imports one or more scripts into the worker's global scope.

    _anyhex.js_
    from [Paul Irish](http://www.paulirish.com/2009/random-hex-color-code-snippets/)

    ```js
    function anyHex() {
      return '#' + Math.floor(Math.random() * 16777215).toString(16);
    }
    ```

    ```js
    spawn(function {
      // load it
      spawn.importScripts('anyhex.js');

      spawn.on('anyhex', function(_, send) {
        send( anyHex() );
      });
    });
    ```

    or

    ```js
    var worker = spawn(function {
      spawn.on('anyhex', function(_, send) {
        send( anyHex() );
      });
    });
    // load it
    worker.importScripts('anyhex.js');
    ```
