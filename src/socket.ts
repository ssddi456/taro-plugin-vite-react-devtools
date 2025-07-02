const ALIPAY = 'alipay'

const getGlobalApi = () => {
    if (process.env.TARO_ENV === ALIPAY) {
        // @ts-ignore
        return my;
    }
    if (process.env.TARO_ENV === 'weapp') {
        // @ts-ignore
        return wx;
    }
    if (process.env.TARO_ENV === 'tt') {
        // @ts-ignore
        return tt;
    }
    if (process.env.TARO_ENV === 'swan') {
        // @ts-ignore
        return swan;
    }
    if (process.env.TARO_ENV === 'jd') {
        // @ts-ignore
        return jd;
    }
    if (process.env.TARO_ENV === 'qq') {
        // @ts-ignore
        return qq;
    }
}

export default class CustomSocket {
    url: string
    readyState: number
    declare onclose: (res: any) => void
    declare onerror: (res: any) => void
    declare onmessage: (res: any) => void
    declare onopen: (res: any) => void

    private _ws: any

    constructor(url: string) {
        this.url = url
        this.readyState = this.CONNECTING;

        new Promise((resolve, reject) => {
            const task = getGlobalApi().connectSocket({
                url: this.url,
                success: () => {
                    setTimeout(() => {
                        resolve(task);
                    }, 100);
                }
            });
        })
            .then((ws: any) => {
                console.log('socket connected:', ws);
                this._ws = ws

                ws.onClose((res: any) => {
                    this.readyState = this.CLOSED
                    this.onclose(res)
                })

                ws.onError((res: any) => {
                    console.log('WebSocket error:', res);
                    this.readyState = this.CLOSED
                    this.onerror(res)
                })

                ws.onMessage((res: any) => {
                    if (res.data.includes('"event":"highlightNativeElement"')) {
                        // 元素高亮暂时不实现，需要魔改 backend 的代码
                        return
                    }
                    console.log('WebSocket message:', res);
                    this.onmessage?.(res)
                })

                if (this.readyState !== this.OPEN) {
                    ws.onOpen((res: any) => {
                        this.readyState = this.OPEN
                        this.onopen(res)
                    })
                } else {
                    // 支付宝全局的 onSocketOpen 已触发过了，直接调用 onopen
                    this.onopen({})
                }
            })
        // 支付宝只支持一个 socket 连接，且 onSocketOpen 的触发时机比 connectSocket 回调的时机早
        if (process.env.TARO_ENV === ALIPAY) {
            getGlobalApi().onSocketOpen(() => {
                this.readyState = this.OPEN
            })
        }
    }

    public send(data: string | ArrayBuffer) {
        console.log('send WebSocket message:', data);
        this._ws.send({
            data
        })
    }

    public close(code: number, reason: string) {
        this.readyState = this.CLOSING
        this._ws.close({
            code: code || 1000,
            reason: reason || ''
        })
    }

    doConnect() {
        
    }

    get CONNECTING() {
        return 0
    }

    get OPEN() {
        return 1
    }

    get CLOSING() {
        return 2
    }

    get CLOSED() {
        return 3
    }
}