# taro-plugin-vite-react-devtools
inject  react-devtools  for weapp when use taro's vite compiler


## install

```bash
npm install taro-plugin-vite-react-devtools --save-dev
```

## usage

in taro vite react project, add the plugin to `config/dev.ts`:
```typescript

export default {
    mini: {
        debugReact: true, // set to true to make sure use react run in development mode
    },

    plugins: [
        ['taro-plugin-vite-react-devtools', {
            enabled: true, // if enabled === false or NODE_ENV === 'production', this plugin will not work
            hostname: 'localhost', // the hostname of the react-devtools server, default is 'localhost'
            port: '8097', // the port of the react-devtools server, default is '8097'
            open: true, // if true, will open the react-devtools electron app automatically
        }],
    ],
}

```

## explain

this plugin will inject the react-devtools script into the weapp, and connect to the react-devtools server.

and make some changes to the react-devtools' behavior to better support taro weapp development.