module.exports = function(grunt) {
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-bump');

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    meta: {
      banner:
      '/**\n' +
      ' * <%= pkg.name %>! <%= pkg.description %>\n' +
      ' * @version v<%= pkg.version %> - <%= grunt.template.today("yyyy-mm-dd") %>\n' +
      ' * @author <%= pkg.author %>\n' +
      ' * Copyright (c) <%= grunt.template.today("yyyy") %> Kevin James\n' +
      ' * Licensed under the MIT license.\n' +
      ' * <%= pkg.homepage %>\n' +
      ' */\n'
    },
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
        dest: 'dist/spawn.js',
        options: {
          process: function(src) {
            return grunt.template.process('<%= meta.banner %>') + src;
          }
        }
      }
    },
    uglify: {
      spawn: {
        files: {
          'dist/spawn.min.js': 'src/spawn.js'
        },
        options: {
          banner: '<%= meta.banner %>'
        }
      }
    },
    watch: {
      spawn: {
        files: ['gruntfile.js', 'src/*.js'],
        tasks: ['default']
      }
    },
    bump: {
      options: {
        commitMessage: 'grunt-bump: Bump version to %VERSION%',
        tagMessage: 'grunt-bump: Tagging release %VERSION%',
        commitFiles: ['-a'],
        pushTo: 'origin'
      }
    }
  });

  grunt.registerTask('default', ['jshint']);
  grunt.registerTask('dist', ['clean', 'jshint', 'copy', 'uglify']);

  grunt.registerTask('_updatePkgInfo', function() {
    grunt.config.set('pkg', grunt.file.readJSON('package.json'));
  });

  grunt.registerTask('release', function release(target) {
    target = target ? ':' + target : '';

    grunt.task.run([
      'bump-only' + target,
      '_updatePkgInfo',
      'dist',
      'bump-commit'
    ]);
  });
};
