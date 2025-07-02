import { chalk } from '@tarojs/helper';
import path from 'path';

import type { IndexHtmlTransform, Plugin } from 'vite'
import type { IPluginContext, TaroPlatformBase } from '@tarojs/service'

const windowsSlashRE = /\\/g;
function slash(p: string) {
    return p.replace(windowsSlashRE, "/");
} 
const isWindows = typeof process !== "undefined" && process.platform === "win32";

function normalizePath(id: string) {
    return path.posix.normalize(isWindows ? slash(id) : id);
}

const injectedRuntimePath = '' + path.join(__dirname, '../src/runtime.ts').replace(/\\/g, '/');
const injectedSocketPath = '' + path.join(__dirname, '../src/socket.ts').replace(/\\/g, '/');

function transformReactDevtoolsBackend(code: string): string {
    const updatedQueueMicrotaskCode = code.replace(/queueMicrotask/g, 'window.queueMicrotask');

    const updatedCode = [
        updateCreateFiberCode,
        updateGetSourceLocationByFiber,
        updateShowOverlayWeb,
        updateShouldFilterFiber,
    ].reduce((currentCode, process) => {
        return process(currentCode);
    }, updatedQueueMicrotaskCode);

    return updatedCode;
}

function updateCreateFiberCode(updatedQueueMicrotaskCode: string): string {
    const func_code = 'function createFiberInstance(fiber) {';
    const func_code_index = updatedQueueMicrotaskCode.indexOf(func_code);
    if (func_code_index === -1) {
        console.log('createFiberInstance function not found in react-devtools-core backend code');
        return updatedQueueMicrotaskCode;
    }

    const source_prop_index = updatedQueueMicrotaskCode.indexOf('source: null', func_code_index + func_code.length);
    if (source_prop_index === -1) {
        console.log('source: null property not found in react-devtools-core backend code');
        return updatedQueueMicrotaskCode;
    }

    const updated_func_code = `source: fiber._debugSource ? Object.assign({
    sourceURL: fiber._debugSource.fileName,
    line: fiber._debugSource.lineNumber - 19,
}, fiber._debugSource) : null`;

    const updatedQueueMicrotaskCodeWithSource = updatedQueueMicrotaskCode.slice(0, source_prop_index)
        + updated_func_code
        + updatedQueueMicrotaskCode.slice(source_prop_index + 'source: null'.length);

    return updatedQueueMicrotaskCodeWithSource;
}

function updateGetSourceLocationByFiber(updatedCreateFiberCode: string): string {
    const func_code = 'function getSourceLocationByFiber(workTagMap, fiber, currentDispatcherRef) {';
    const func_code_index = updatedCreateFiberCode.indexOf(func_code);
    if (func_code_index === -1) {
        console.log('getSourceLocationByFiber function not found in react-devtools-core backend code');
        return updatedCreateFiberCode;
    }

    const updated_func_code = `function getSourceLocationByFiber() {
    return null;
`;

    return updatedCreateFiberCode.slice(0, func_code_index) + updated_func_code + updatedCreateFiberCode.slice(func_code_index + func_code.length);
}

function updateShowOverlayWeb(updatedCreateFiberCode: string): string {
    const func_code = 'function showOverlayWeb(elements, componentName, agent, hideAfterTimeout) {';
    const func_code_index = updatedCreateFiberCode.indexOf(func_code);
    if (func_code_index === -1) {
        console.log('showOverlayWeb function not found in react-devtools-core backend code');
        return updatedCreateFiberCode;
    }

    const updated_func_code = `function showOverlayWeb(elements, componentName, agent, hideAfterTimeout) {
    return true;
`;

    return updatedCreateFiberCode.slice(0, func_code_index) + updated_func_code + updatedCreateFiberCode.slice(func_code_index + func_code.length);
}


function updateShouldFilterFiber(updatedCreateFiberCode: string): string {
    const func_code = 'function shouldFilterFiber(fiber) {';
    const func_code_index = updatedCreateFiberCode.indexOf(func_code);
    if (func_code_index === -1) {
        console.log('shouldFilterFiber function not found in react-devtools-core backend code');
        return updatedCreateFiberCode;
    }

    const rootCaseStr = 'case HostRoot:\n'
    const hostRootIndex = updatedCreateFiberCode.indexOf(rootCaseStr, func_code_index + func_code.length);
    if (hostRootIndex === -1) {
        console.log('hostRootIndex case not found in react-devtools-core backend code');
        return updatedCreateFiberCode;
    }


    const updated_func_code = `case HostComponent:\n`;

    return updatedCreateFiberCode.slice(0, hostRootIndex) + updated_func_code + updatedCreateFiberCode.slice(hostRootIndex);
}


export interface IOptions {
    enabled?: boolean
    hostname?: string
    port?: string
    open?: boolean
}


export default function (ctx: IPluginContext, options: IOptions) {
    if (process.env.NODE_ENV === 'production' || options.enabled === false) {
        return;
    }

    const hostname = String(options.hostname || 'localhost')
    const port = Number(options.port || '8097')
    if (options.open !== false) {
        let binPath = '';
        try {
            binPath = require.resolve('react-devtools/bin', {
                paths: [ctx.paths.nodeModulesPath]
            });
        } catch (error) {
            console.log(`require.resolve 错误：${error}, 请确保已安装 react-devtools`);
            return;
        }
        
        const spawn = require('cross-spawn');
        const detectPort = require('detect-port');
        
        console.log('spawn', spawn, 'detectPort', detectPort);
        detectPort(port, (err: any, availablePort: number) => {
            if (err) {
                // eslint-disable-next-line no-console
                console.log(`detectPort 错误：${err}`);
            }

            if (availablePort === port) {
                // eslint-disable-next-line no-console
                console.log(chalk.yellow('\n提示  ') + '正在启动 react-devtools...\n');
                spawn(binPath,
                    [ctx.paths.sourcePath],
                    { env: { ...process.env, PORT: port } });
            }
        })
    }

    ctx.registerMethod({
        name: 'onSetupClose',
        fn(platform: TaroPlatformBase) {
            injectRuntimePath(platform)
        }
    });

    ctx.modifyRunnerOpts(({ opts }) => {
        // console.log('opts.compiler', opts.compiler);
        if (opts.compiler?.type == 'vite') {
            opts.compiler.vitePlugins = opts.compiler.vitePlugins || [];
            console.log('process.env.TARO_ENV', process.env.TARO_ENV);
            if (process.env.TARO_ENV === 'weapp'
                || process.env.TARO_ENV === 'h5'
            ) {
                if (opts.defineConstants) {
                    opts.defineConstants.__REACT_DEVTOOLS_HOSTNAME__ = JSON.stringify(hostname || 'localhost');
                    opts.defineConstants.__REACT_DEVTOOLS_PORT__ = JSON.stringify(port || '8097');
                }

                (opts.compiler.vitePlugins as Plugin[]).push({
                    name: 'react-devtools',
                    config: {
                        handler(config) {
                            if (process.env.TARO_ENV !== 'h5') {

                                const output = config.build?.rollupOptions?.output;
                                if (output) {
                                    console.log('update manualChunks');
                                    (Array.isArray(config.build!.rollupOptions!.output)
                                        ? config.build!.rollupOptions!.output
                                        : [config.build!.rollupOptions!.output])
                                        .forEach((outputItem) => {
                                            if (outputItem && outputItem.manualChunks) {
                                                const manualChunks = outputItem.manualChunks;
                                                if (typeof manualChunks === 'function') {
                                                    outputItem.manualChunks = (id: string, ctx) => {
                                                        if (id.indexOf('/react-devtools-core/dist/backend.js') !== -1) {
                                                            return 'taro';
                                                        }
    
                                                        if (id === injectedRuntimePath
                                                            || id === injectedSocketPath
                                                        ) {
                                                            console.log('plugin files, ', id);
                                                            return 'taro';
                                                        }
    
                                                        return manualChunks(id, ctx);
                                                    };
                                                }
                                            }
                                        });
                                }
                            }
                            if (config.esbuild) {
                                config.esbuild.jsxDev = true;
                            }
                            return config;
                        }
                    },
                    transform: {
                        order: 'pre',
                        handler: (code: string, id: string) => {
                            if (/\/react\-reconciler\.(development|production\.min)\.js$/.test(id)) {
                                return code.replace(/__REACT_DEVTOOLS_GLOBAL_HOOK__/g, 'window.__REACT_DEVTOOLS_GLOBAL_HOOK__');
                            }

                            if (/\/react\-devtools\-core(\/dist\/|_)backend\.js($|\?)/.test(id)) {
                                console.log('\nbackid', id,);
                                return transformReactDevtoolsBackend(code);
                            }
                        }
                    },
                    transformIndexHtml: {
                        order: 'post',
                        handler: function (html: string, htmlCtx) {
                            if (process.env.TARO_ENV === 'h5') {
                                html = html.replace(/(<script[> ])/, `
<script type="module">
    import { default as backend } from "${htmlCtx.server!.config.base}@fs/${normalizePath(ctx.paths!.nodeModulesPath)}/.vite/deps/react-devtools-core_dist_backend.js";
    console.log('react-devtools-core backend', backend);
    backend.initialize();
</script>
$1`);
                            }
                            return html;
                        }
                    } as IndexHtmlTransform
                });
            }
        }
    })
}


function injectRuntimePath(platform: TaroPlatformBase) {
    if (Array.isArray(platform.runtimePath)) {
        (platform.runtimePath as string[]).unshift(injectedRuntimePath);
    } else if (typeof platform.runtimePath === 'string') {
        platform.runtimePath = [injectedRuntimePath, platform.runtimePath as string,];
    }
}
// @tarojs/plugin-platform-weapp/dist/runtime