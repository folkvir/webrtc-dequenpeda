const UglifyJSPlugin = require('uglifyjs-webpack-plugin')
const lmerge = require('lodash.merge')
const webpackconfig = require('./foglet-webpack-config')
module.exports = lmerge(webpackconfig, {
  mode: 'production',
  output: {
    'filename': '[name]/webrtc-dequenpeda.bundle.min.js',
  },
  plugins: [new UglifyJSPlugin({
    sourceMap: true
  })]
})
