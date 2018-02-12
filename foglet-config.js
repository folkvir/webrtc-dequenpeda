'use strict'
const path = require('path')
module.exports = {
  browsers: [ 'Firefox' ],
  timeout: 20000,
  lint: true,
  build: {
    entry: {
      dist: './webrtc-dequenpeda.js'
    },
    output: {
      'path': path.resolve(process.cwd(), '.'),
      'filename': 'dist/webrtc-dequenpeda.bundle.js',
      'library': 'dequenpeda',
      'libraryTarget': 'umd',
      'umdNamedDefine': true
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: () => {
            return true
          },
          use: {
            loader: 'babel-loader',
            options: {
              presets: [ 'env' ]
            }
          }
        },
        { test: /\.json$/, loader: 'json-loader' }
      ]
    },
    devtool: 'source-map',
    node: {
      console: true,
      fs: 'empty',
      net: 'empty',
      tls: 'empty'
    }
  }
}
