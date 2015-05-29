module.exports = function(grunt) {
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-watch');

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
        files: ['gruntfile.js', 'src/*.js'],
        tasks: ['default']
      }
    }
  });

  grunt.registerTask('default', ['jshint']);
  grunt.registerTask('dist', ['clean', 'jshint', 'uglify']);
};