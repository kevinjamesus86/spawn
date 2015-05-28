module.exports = function(grunt) {
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-mocha');

  grunt.initConfig({
    clean: {
      spawn: ['spawn.min.js']
    },
    jshint: {
      spawn: {
        src: ['gruntfile.js', 'src/*.js']
      }
    },
    uglify: {
      spawn: {
        files: {
          'spawn.min.js': 'src/spawn.js'
        }
      }
    },
    watch: {
      spawn: {
        files: ['gruntfile.js', 'src/*.js', 'tests/*.js'],
        tasks: ['default']
      }
    },
    mocha: {
      spawn: {
        src: ['tests/index.html'],
        options: {
          run: true
        }
      }
    }
  });

  grunt.registerTask('default', ['clean', 'jshint', 'mocha']);
  grunt.registerTask('dist', ['default', 'uglify']);
};