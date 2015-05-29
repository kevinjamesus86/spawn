# spawn [![Codacy Badge](https://www.codacy.com/project/badge/4a6d5150e5834dcf94bc08177422e14e)](https://www.codacy.com/app/kevinjamesus86/spawn)
_sane, evented, flexible threading for modern browsers_

### Download

+ JS
 - [spawn.js](https://raw.githubusercontent.com/kevinjamesus86/spawn/master/dist/spawn.js) big, or
 - [spawn.min.js](https://raw.githubusercontent.com/kevinjamesus86/spawn/master/dist/spawn.min.js) small

## Install

```html
<script src="https://cdn.rawgit.com/kevinjamesus86/spawn/v0.1.0/dist/spawn.js"></script>
or
<script src="https://cdn.rawgit.com/kevinjamesus86/spawn/v0.1.0/dist/spawn.min.js"></script>
```

## Usage

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

    // listen for the `big fib` event
    spawn.on('big fib', function(val, respond) {

      // send the result back to the emitter
      respond( fib(val) );
    });

  }
);

// emit an event and send some data to the worker
worker.emit('big fib', 42, function(result) {

  // the *async* result of our workers labor
  console.log('the fib of 42 is:', result);
});
```
