const path = require('path')
module.exports = {
  mode: 'development',
  entry: {
    dist: './webrtc-dequenpeda.js'
  },
  output: {
    'path': path.resolve(process.cwd(), '.'),
    'filename': '[name]/webrtc-dequenpeda.bundle.js',
    'library': 'dequenpeda',
    'libraryTarget': 'umd',
    'umdNamedDefine': true
  },
  resolve: {
    alias: {
      "./store-worker": path.resolve(__dirname, './src/store'), // no nodejs worker for the browser.
    }
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
