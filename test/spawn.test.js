
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

  afterEach(function() {
    worker.close();
    worker = null;
  });

  it('should instantiate with a function', function() {
    function init() {
      worker = spawn(function(){});
    }
    expect(init).not.toThrow();
  });

});