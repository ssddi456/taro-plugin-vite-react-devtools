import { initialize, connectToDevTools } from "react-devtools-core/dist/backend";
import CustomSocket from "./socket";
declare const __REACT_DEVTOOLS_HOSTNAME__: string
declare const __REACT_DEVTOOLS_PORT__: number

if (typeof queueMicrotask === 'undefined') {
    const originqueueMicrotask = window.queueMicrotask;
    
    const queueMicrotask = (callback: any) => {
        if (originqueueMicrotask) {
            originqueueMicrotask(callback);
        } else {
            Promise.resolve()
                .then(callback)
                .catch(err => setTimeout(() => {
                    throw err;
                }));
        }
    };
    window.queueMicrotask = queueMicrotask;
}

initialize()

if (typeof WebSocket !== 'undefined') {
    const ws = new WebSocket(`ws://${__REACT_DEVTOOLS_HOSTNAME__}:${__REACT_DEVTOOLS_PORT__}`);
    connectToDevTools({
        websocket: ws
    });
} else {
    try {
        const ws = new CustomSocket(`ws://${__REACT_DEVTOOLS_HOSTNAME__}:${__REACT_DEVTOOLS_PORT__}`);
        connectToDevTools({
            websocket: ws
        });
    } catch (e) {
        console.log('connect ide failed', e);
    }
}
