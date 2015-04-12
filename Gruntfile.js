module.exports = function (grunt) {

  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-browserify')

  grunt.registerTask('default','watch')

  grunt.initConfig({

    browserify: {
      main: {
        src: 'public/js/main.js',
        dest: 'public/build/bundle.js',
        files: {
          'public/build/bundle.js': ['**/*.js'],
        },
        options: {
          transform: ['brfs']
        }
      }
    },

    watch: {
      everything: {
        files: ['**/*.html','**/js/*.js'],
        tasks: ['browserify'],
        options: {
          livereload: {
            port: 9000,
            key: grunt.file.read('nginx.key'),
            cert: grunt.file.read('nginx.crt')
              // you can pass in any other options you'd like to the https server, as listed here: http://nodejs™.org/api/tls.html#tls_tls_createserver_options_secureconnectionlistener
          }
        },
      },
    }

  })


}
