'use strict'
const webpack = require('./foglet-webpack-config')
module.exports = {
  browsers: [ 'Firefox' ],
  timeout: 20000,
  lint: true,
  build: webpack
}
