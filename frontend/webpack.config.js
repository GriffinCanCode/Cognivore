const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');

// Determine if we're in development mode
const isDev = process.env.NODE_ENV !== 'production';

module.exports = {
  entry: {
    main: './src/index.js',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    clean: true,
    // Ensure no CommonJS is used in the output bundle
    environment: {
      // The environment supports arrow functions
      arrowFunction: true,
      // The environment supports BigInt as literal
      bigIntLiteral: false,
      // The environment supports const and let
      const: true,
      // The environment supports destructuring
      destructuring: true,
      // The environment supports dynamic import() expression
      dynamicImport: false,
      // The environment supports 'for of' iteration
      forOf: true,
      // The environment supports ECMAScript Module syntax to import ECMAScript modules
      module: false,
    }
  },
  target: 'web', // Change to 'web' instead of 'electron-renderer' for better compatibility
  // Use a devtool that doesn't require eval for CSP compatibility
  devtool: isDev ? 'inline-source-map' : 'source-map',
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react']
          }
        }
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html',
      filename: 'index.html',
      // Add CSP meta tag to HTML template
      meta: {
        'Content-Security-Policy': {
          'http-equiv': 'Content-Security-Policy',
          'content': "default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; media-src 'self' blob:; worker-src 'self' blob:; connect-src 'self' https://*.googleapis.com"
        }
      }
    }),
    new CopyWebpackPlugin({
      patterns: [
        { 
          from: 'public/styles', 
          to: 'styles',
          globOptions: {
            ignore: ['**/*.js', '**/*.jsx']
          }
        },
        {
          from: 'public/mnemosyne.css',
          to: 'mnemosyne.css'
        },
        {
          from: 'public/assets',
          to: 'assets',
          globOptions: {
            ignore: ['**/*.spec.js']
          }
        },
        {
          from: 'public/images/characters',
          to: 'images/characters',
          globOptions: {
            ignore: ['**/*.spec.js']
          }
        }
      ]
    }),
    // Provide Buffer and Node.js globals
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser'
    }),
    // Define process.env.NODE_ENV and other Node.js globals
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      'process.env': JSON.stringify(process.env || {}),
      // Define __dirname and __filename as empty string instead of trying to use the Node.js values
      __dirname: JSON.stringify('/'),
      __filename: JSON.stringify('/index.js')
    }),
    // Add empty module for worker_threads
    new webpack.NormalModuleReplacementPlugin(
      /worker_threads/,
      path.resolve(__dirname, 'src/mocks/worker-threads-mock.js')
    ),
    // Ignore specific modules that aren't needed
    new webpack.IgnorePlugin({
      resourceRegExp: /^(fs|crypto)$/
    })
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, 'dist')
    },
    compress: true,
    port: 9000,
    hot: true,
    open: true,
    proxy: {
      '/api': 'http://localhost:3001'
    }
  },
  resolve: {
    extensions: ['.js', '.jsx', '.json'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // Add alias for worker_threads
      'worker_threads': path.resolve(__dirname, 'src/mocks/worker-threads-mock.js')
    },
    // Add fallbacks for Node.js core modules
    fallback: {
      "url": require.resolve('url/'),  // Use url polyfill
      "path": require.resolve('path-browserify'),  // Use path-browserify
      "fs": false,   // Disable Node.js fs module
      "util": require.resolve('util/'),  // Use util polyfill
      "buffer": require.resolve('buffer/'),  // Add buffer polyfill with absolute path
      "querystring": require.resolve('querystring-es3'),  // Add querystring polyfill
      "process": require.resolve('process/browser'),  // Add process polyfill with absolute path
      "stream": require.resolve('stream-browserify'),  // Use stream-browserify
      "zlib": require.resolve('browserify-zlib'),  // Use browserify-zlib
      "crypto": false,
      "worker_threads": false // Disable worker_threads
    }
  },
  // Externals to avoid bundling Node.js modules
  externals: {
    electron: 'commonjs electron'
  },
  // Explicitly disable node-specific features
  node: false
}; 