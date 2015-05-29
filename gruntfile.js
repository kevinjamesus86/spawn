module.exports = function(grunt) {
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-watch');

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    clean: {
      spawn: ['dist/**']
    },
    jshint: {
      spawn: {
        src: ['gruntfile.js', 'src/*.js']
      }
    },
    copy: {
      spawn: {
        src: 'src/spawn.js',
        dest: 'dist/spawn.js'
      }
    },
    uglify: {
      spawn: {
        files: {
          'dist/spawn.min.js': 'src/spawn.js'
        },
        options: {
          banner: '/**\n' +
            ' * <%= pkg.description %>\n' +
            ' * @version v<%= pkg.version %> - <%= grunt.template.today("yyyy-mm-dd") %>\n' +
            ' * @author <%= pkg.author %>\n' +
            ' * Copyright (c) <%= grunt.template.today("yyyy") %> Kevin James\n' +
            ' * Licensed under the MIT license.\n' +
            ' */\n'
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
  grunt.registerTask('dist', ['clean', 'jshint', 'copy', 'uglify']);
};